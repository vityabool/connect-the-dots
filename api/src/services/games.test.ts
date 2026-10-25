import { DEFAULT_TOPICS, LIMITS } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../http';
import { createGame, deleteGame, getGame, listGames, updateGame } from './games';
import { makeDeps } from './testing';
import { addTopics, deleteTopic } from './topics';

const ANNA = 'owner-anna';
const BOB = 'owner-bob';

describe('createGame', () => {
  it('creates a game with a 6-digit code and a 3-day expiry', async () => {
    const { deps } = makeDeps({ codes: ['042917'] });
    const game = await createGame(deps, ANNA, '  Offsite   2026 ');
    expect(game.name).toBe('Offsite 2026');
    expect(game.code).toBe('042917');
    expect(game.expired).toBe(false);
    expect(Date.parse(game.expiresAt) - Date.parse(game.createdAt)).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('keeps every default topic within the topic name limit', () => {
    expect(LIMITS.maxTopicNameLength).toBe(30);
    for (const topic of DEFAULT_TOPICS) expect(topic.length).toBeLessThanOrEqual(LIMITS.maxTopicNameLength);
  });

  it('starts every game with the ten default topics', async () => {
    const { deps } = makeDeps();
    const game = await createGame(deps, ANNA, 'Offsite');
    const topics = (await getGame(deps, ANNA, game.id)).topics;
    expect(topics.map((topic) => topic.name).sort()).toEqual([...DEFAULT_TOPICS].sort());
    expect(DEFAULT_TOPICS).toHaveLength(10);
    expect(DEFAULT_TOPICS).toContain('🎾 Play tennis');
    expect(DEFAULT_TOPICS).toContain('🍕 Love pineapple on pizza');
  });

  it('lets the owner delete or restore default topics without touching other games', async () => {
    const { deps } = makeDeps();
    const game = await createGame(deps, ANNA, 'Offsite');
    const first = (await getGame(deps, ANNA, game.id)).topics[0] ?? { id: '', name: '' };
    await deleteTopic(deps, ANNA, game.id, first.id);
    expect((await getGame(deps, ANNA, game.id)).topics).toHaveLength(9);

    // "Restore the default topics" adds the missing one back and skips the nine that exist.
    const restored = await addTopics(deps, ANNA, game.id, { names: [...DEFAULT_TOPICS] });
    expect(restored.added.map((topic) => topic.name)).toEqual([first.name]);
    expect(restored.duplicatesSkipped).toBe(9);

    const next = await createGame(deps, ANNA, 'Second offsite');
    await deleteTopic(deps, ANNA, next.id, first.id);
    expect((await getGame(deps, ANNA, game.id)).topics).toHaveLength(10);
  });

  it('rejects an empty or too long name', async () => {
    const { deps } = makeDeps();
    await expect(createGame(deps, ANNA, '   ')).rejects.toMatchObject({ status: 400 });
    await expect(createGame(deps, ANNA, 'x'.repeat(81))).rejects.toMatchObject({ status: 400 });
    await expect(createGame(deps, ANNA, 42)).rejects.toMatchObject({ status: 400 });
  });

  it('never gives the same code to two active games', async () => {
    const { deps } = makeDeps({ codes: ['111111', '111111', '222222'] });
    const first = await createGame(deps, ANNA, 'One');
    const second = await createGame(deps, BOB, 'Two');
    expect(first.code).toBe('111111');
    expect(second.code).toBe('222222');
  });

  it('reuses a code once the game that held it has expired', async () => {
    const { deps, advanceDays } = makeDeps({ codes: ['111111', '111111'] });
    await createGame(deps, ANNA, 'Old');
    advanceDays(4);
    const fresh = await createGame(deps, BOB, 'New');
    expect(fresh.code).toBe('111111');
  });

  it('limits the number of games per admin', async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 50; i += 1) await createGame(deps, ANNA, `Game ${i}`);
    await expect(createGame(deps, ANNA, 'One too many')).rejects.toMatchObject({ status: 409 });
  });
});

describe('listGames and ownership', () => {
  it('lists only the admin\'s own games, newest first', async () => {
    const { deps, advanceDays } = makeDeps();
    await createGame(deps, ANNA, 'First');
    advanceDays(1);
    await createGame(deps, ANNA, 'Second');
    await createGame(deps, BOB, 'Bob game');
    const names = (await listGames(deps, ANNA)).map((g) => g.name);
    expect(names).toEqual(['Second', 'First']);
  });

  it('hides other admins\' games as "not found"', async () => {
    const { deps } = makeDeps();
    const game = await createGame(deps, ANNA, 'Private');
    await expect(getGame(deps, BOB, game.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateGame(deps, BOB, game.id, { name: 'Hijack' })).rejects.toMatchObject({ status: 404 });
    await expect(deleteGame(deps, BOB, game.id)).rejects.toMatchObject({ status: 404 });
    expect((await getGame(deps, ANNA, game.id)).name).toBe('Private');
  });

  it('answers 404 for malformed ids', async () => {
    const { deps } = makeDeps();
    await expect(getGame(deps, ANNA, '../etc')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('updateGame', () => {
  it('renames a game and bumps the version', async () => {
    const { deps } = makeDeps();
    const game = await createGame(deps, ANNA, 'Old name');
    await updateGame(deps, ANNA, game.id, { name: 'New name' });
    const details = await getGame(deps, ANNA, game.id);
    expect(details.name).toBe('New name');
    expect(details.version).toBeGreaterThan(1);
    expect((await listGames(deps, ANNA))[0]?.name).toBe('New name');
  });

  it('extends the expiry date and reopens an expired game', async () => {
    const { deps, advanceDays } = makeDeps();
    const game = await createGame(deps, ANNA, 'Long event');
    advanceDays(5);
    expect((await getGame(deps, ANNA, game.id)).expired).toBe(true);

    const newExpiry = new Date(deps.now().getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const updated = await updateGame(deps, ANNA, game.id, { expiresAt: newExpiry });
    expect(updated.expired).toBe(false);
    expect(updated.expiresAt).toBe(newExpiry);
    expect((await listGames(deps, ANNA))[0]?.expired).toBe(false);
  });

  it('rejects past dates, junk and dates too far away', async () => {
    const { deps } = makeDeps();
    const game = await createGame(deps, ANNA, 'Event');
    const day = 24 * 60 * 60 * 1000;
    const past = new Date(deps.now().getTime() - day).toISOString();
    const far = new Date(deps.now().getTime() + 31 * day).toISOString();
    await expect(updateGame(deps, ANNA, game.id, { expiresAt: past })).rejects.toMatchObject({ status: 400 });
    await expect(updateGame(deps, ANNA, game.id, { expiresAt: far })).rejects.toMatchObject({ status: 400 });
    await expect(updateGame(deps, ANNA, game.id, { expiresAt: 'tomorrow-ish' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('keeps the code reserved while the extended game is active', async () => {
    const { deps, advanceDays } = makeDeps({ codes: ['333333', '333333', '444444'] });
    const game = await createGame(deps, ANNA, 'Event');
    advanceDays(2);
    const newExpiry = new Date(deps.now().getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await updateGame(deps, ANNA, game.id, { expiresAt: newExpiry });
    advanceDays(2); // past the original expiry, still inside the extension
    const other = await createGame(deps, BOB, 'Other');
    expect(other.code).toBe('444444');
  });
});

describe('deleteGame', () => {
  it('removes the game with all its data and frees the code', async () => {
    const { deps, tables } = makeDeps({ codes: ['555555', '555555'] });
    const game = await createGame(deps, ANNA, 'Temporary');
    await tables.insert('Participants', { partitionKey: game.id, rowKey: 'p1', name: 'Anna' });
    await tables.insert('Topics', { partitionKey: game.id, rowKey: 't1', name: 'Dogs' });
    await tables.insert('Connections', { partitionKey: game.id, rowKey: 'p1:p2:t1', aId: 'p1', bId: 'p2' });

    await deleteGame(deps, ANNA, game.id);

    expect(await listGames(deps, ANNA)).toEqual([]);
    expect(await tables.list('Participants', game.id)).toEqual([]);
    expect(await tables.list('Topics', game.id)).toEqual([]);
    expect(await tables.list('Connections', game.id)).toEqual([]);
    expect(await tables.get('Games', game.id, 'game')).toBeUndefined();
    const again = await createGame(deps, BOB, 'Reuse code');
    expect(again.code).toBe('555555');
  });
});
