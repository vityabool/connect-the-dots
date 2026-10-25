import { nameKey } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { createGame, getGame, updateGame } from './games';
import { RETENTION_AFTER_EXPIRY_DAYS, runCleanup } from './cleanup';
import { addParticipants } from './participants';
import { authenticate, authenticateIdentified, createConnection, joinGame, pickIdentity } from './play';
import { hashClient } from './rateLimit';
import { makeDeps } from './testing';
import { addTopics } from './topics';

const SECRET = 'test-secret';
const OWNER = 'owner-anna';
const DAY = 24 * 60 * 60 * 1000;

describe('rate limiting does not keep IP addresses', () => {
  it('stores only a keyed hash of the client address', async () => {
    const { deps, tables } = makeDeps({ codes: ['123456'] });
    await createGame(deps, OWNER, 'Game');
    await joinGame(deps, SECRET, '000000', '203.0.113.7').catch(() => undefined);

    const rows = await tables.scan('RateLimits');
    expect(rows).toHaveLength(1);
    const key = rows[0]?.partitionKey ?? '';
    expect(key).toBe(`join:${hashClient(SECRET, '203.0.113.7')}`);
    expect(key).not.toContain('203.0.113.7');
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7');
  });

  it('gives the same client the same key and different clients different keys', () => {
    expect(hashClient(SECRET, '198.51.100.1')).toBe(hashClient(SECRET, '198.51.100.1'));
    expect(hashClient(SECRET, '198.51.100.1')).not.toBe(hashClient(SECRET, '198.51.100.2'));
    expect(hashClient('another-secret', '198.51.100.1')).not.toBe(hashClient(SECRET, '198.51.100.1'));
  });

  it('still blocks a client after too many wrong codes', async () => {
    const { deps } = makeDeps({ codes: ['123456'] });
    await createGame(deps, OWNER, 'Game');
    for (let i = 0; i < 10; i += 1) await joinGame(deps, SECRET, '000000', 'guesser').catch(() => undefined);
    await expect(joinGame(deps, SECRET, '123456', 'guesser')).rejects.toMatchObject({ status: 429 });
    await expect(joinGame(deps, SECRET, '123456', 'someone-else')).resolves.toBeDefined();
  });

  it('keeps only the current window\'s row per client', async () => {
    const { deps, tables, advanceDays } = makeDeps({ codes: ['123456'] });
    await createGame(deps, OWNER, 'Game');
    await joinGame(deps, SECRET, '000000', 'guesser').catch(() => undefined);
    advanceDays(1 / 24); // one hour later: a new 10-minute window
    await joinGame(deps, SECRET, '000000', 'guesser').catch(() => undefined);
    expect(await tables.scan('RateLimits')).toHaveLength(1);
  });
});

describe('automatic cleanup', () => {
  async function gameWithData(ctx: ReturnType<typeof makeDeps>, owner: string, name: string) {
    const game = await createGame(ctx.deps, owner, name);
    await addParticipants(ctx.deps, owner, game.id, { text: 'Anna Koval\nIvan Petrenko' });
    await addTopics(ctx.deps, owner, game.id, { text: 'Have dogs' });
    const topicId = (await getGame(ctx.deps, owner, game.id)).topics[0]?.id ?? '';
    const joined = await joinGame(ctx.deps, SECRET, game.code, `ip-${name}`);
    const anon = await authenticate(ctx.deps, SECRET, joined.token);
    const picked = await pickIdentity(ctx.deps, SECRET, anon, nameKey('Anna Koval'));
    const anna = await authenticateIdentified(ctx.deps, SECRET, picked.token);
    await createConnection(ctx.deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId });
    return game;
  }

  it('says how long expired games are kept', () => {
    expect(RETENTION_AFTER_EXPIRY_DAYS).toBe(30);
  });

  it('keeps active and recently expired games', async () => {
    const ctx = makeDeps();
    const game = await gameWithData(ctx, OWNER, 'Recent');
    ctx.advanceDays(3 + 29); // expired for 29 days: still kept
    const result = await runCleanup(ctx.deps);
    expect(result.gamesDeleted).toBe(0);
    expect((await getGame(ctx.deps, OWNER, game.id)).participants).toHaveLength(2);
  });

  it('deletes a game and all its data 30 days after it expired', async () => {
    const ctx = makeDeps();
    const game = await gameWithData(ctx, OWNER, 'Old');
    ctx.advanceDays(3 + RETENTION_AFTER_EXPIRY_DAYS + 0.01);
    const result = await runCleanup(ctx.deps);
    expect(result.gamesDeleted).toBe(1);
    for (const table of ['Games', 'GameCodes', 'OwnerGames', 'Participants', 'Topics', 'Connections'] as const) {
      expect(await ctx.tables.scan(table), table).toEqual([]);
    }
    await expect(getGame(ctx.deps, OWNER, game.id)).rejects.toMatchObject({ status: 404 });
  });

  it('only deletes the games that are old enough, and leaves others untouched', async () => {
    const ctx = makeDeps({ codes: ['111111', '222222'] });
    const old = await gameWithData(ctx, OWNER, 'Old');
    ctx.advanceDays(20);
    const fresh = await gameWithData(ctx, 'owner-bob', 'Fresh');
    ctx.advanceDays(15); // Old: expired 32 days ago; Fresh: still running
    const result = await runCleanup(ctx.deps);
    expect(result.gamesDeleted).toBe(1);
    await expect(getGame(ctx.deps, OWNER, old.id)).rejects.toMatchObject({ status: 404 });
    expect((await getGame(ctx.deps, 'owner-bob', fresh.id)).connections).toHaveLength(1);
  });

  it('respects an extended expiry date', async () => {
    const ctx = makeDeps();
    const game = await gameWithData(ctx, OWNER, 'Extended');
    await updateGame(ctx.deps, OWNER, game.id, { expiresAt: new Date(ctx.deps.now().getTime() + 25 * DAY).toISOString() });
    ctx.advanceDays(25 + 29);
    expect((await runCleanup(ctx.deps)).gamesDeleted).toBe(0);
    ctx.advanceDays(2);
    expect((await runCleanup(ctx.deps)).gamesDeleted).toBe(1);
  });

  it('removes rate-limit rows older than a day, keeps recent ones', async () => {
    const ctx = makeDeps({ codes: ['123456'] });
    await createGame(ctx.deps, OWNER, 'Game');
    await joinGame(ctx.deps, SECRET, '000000', 'old-client').catch(() => undefined);
    ctx.advanceDays(2);
    await joinGame(ctx.deps, SECRET, '000000', 'new-client').catch(() => undefined);
    expect(await ctx.tables.scan('RateLimits')).toHaveLength(2);
    const result = await runCleanup(ctx.deps);
    expect(result.rateLimitRowsDeleted).toBe(1);
    expect((await ctx.tables.scan('RateLimits'))[0]?.partitionKey).toBe(`join:${hashClient(SECRET, 'new-client')}`);
  });

  it('removes orphaned index rows that point to games that no longer exist', async () => {
    const ctx = makeDeps();
    await ctx.tables.insert('GameCodes', { partitionKey: '999999', rowKey: 'code', gameId: 'gone', expiresAt: '2026-01-01T00:00:00.000Z' });
    await ctx.tables.insert('OwnerGames', { partitionKey: 'owner', rowKey: 'gone', name: 'x', code: '999999', createdAt: 'x', expiresAt: 'x' });
    const result = await runCleanup(ctx.deps);
    expect(result.orphanRowsDeleted).toBe(2);
    expect(await ctx.tables.scan('GameCodes')).toEqual([]);
    expect(await ctx.tables.scan('OwnerGames')).toEqual([]);
  });

  it('is safe to run twice', async () => {
    const ctx = makeDeps();
    await gameWithData(ctx, OWNER, 'Old');
    ctx.advanceDays(40);
    await runCleanup(ctx.deps);
    expect(await runCleanup(ctx.deps)).toEqual({ gamesDeleted: 0, rateLimitRowsDeleted: 0, orphanRowsDeleted: 0 });
  });
});
