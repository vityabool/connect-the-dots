import { HttpRequest } from '@azure/functions';
import { nameKey } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { sinceParam } from '../http';
import { createGame, getGameIfChanged, updateGame } from './games';
import { addParticipants } from './participants';
import { authenticate, authenticateIdentified, createConnection, deleteConnection, getPlayStateIfChanged, joinGame, pickIdentity } from './play';
import { makeDeps } from './testing';
import { addTopics } from './topics';

const SECRET = 'test-secret';
const OWNER = 'owner-anna';

async function setup() {
  const ctx = makeDeps({ codes: ['123456'] });
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  await addParticipants(ctx.deps, OWNER, game.id, { text: 'Anna Koval\nIvan Petrenko' });
  await addTopics(ctx.deps, OWNER, game.id, { text: 'Have dogs' });

  /** A fresh request context, like a new poll from this player (re-reads the game row). */
  async function poll(name: string) {
    const joined = await joinGame(ctx.deps, SECRET, '123456', `ip-${name}`);
    const anon = await authenticate(ctx.deps, SECRET, joined.token);
    const picked = await pickIdentity(ctx.deps, SECRET, anon, nameKey(name));
    return authenticateIdentified(ctx.deps, SECRET, picked.token);
  }
  return { ...ctx, gameId: game.id, poll };
}

describe('player polling', () => {
  it('returns the full state without a version, and "unchanged" when the version matches', async () => {
    const { deps, poll } = await setup();
    const first = await getPlayStateIfChanged(deps, await poll('Anna Koval'), undefined);
    if ('unchanged' in first) throw new Error('expected a full state');

    const again = await getPlayStateIfChanged(deps, await poll('Anna Koval'), first.game.version);
    expect(again).toEqual({ unchanged: true, version: first.game.version });
  });

  it('notices a connection added by someone else', async () => {
    const { deps, poll } = await setup();
    const first = await getPlayStateIfChanged(deps, await poll('Anna Koval'), undefined);
    if ('unchanged' in first) throw new Error('expected a full state');
    expect(first.connections).toHaveLength(0);

    const ivan = await poll('Ivan Petrenko');
    await createConnection(deps, ivan, { otherId: nameKey('Anna Koval'), newTopicName: 'Have dogs' });

    const next = await getPlayStateIfChanged(deps, await poll('Anna Koval'), first.game.version);
    if ('unchanged' in next) throw new Error('expected the new state');
    expect(next.connections).toHaveLength(1);
    expect(next.connections[0]?.createdByMe).toBe(false);
    expect(next.game.version).toBeGreaterThan(first.game.version);
  });

  it('notices a deleted connection and a new topic', async () => {
    const { deps, poll } = await setup();
    const ivan = await poll('Ivan Petrenko');
    const connection = await createConnection(deps, ivan, { otherId: nameKey('Anna Koval'), newTopicName: 'Have dogs' });
    const first = await getPlayStateIfChanged(deps, await poll('Anna Koval'), undefined);
    if ('unchanged' in first) throw new Error('expected a full state');

    await deleteConnection(deps, ivan, connection.id);
    const afterDelete = await getPlayStateIfChanged(deps, await poll('Anna Koval'), first.game.version);
    if ('unchanged' in afterDelete) throw new Error('expected the new state');
    expect(afterDelete.connections).toHaveLength(0);

    await createConnection(deps, ivan, { otherId: nameKey('Anna Koval'), newTopicName: 'Brand new topic' });
    const afterTopic = await getPlayStateIfChanged(deps, await poll('Anna Koval'), afterDelete.game.version);
    if ('unchanged' in afterTopic) throw new Error('expected the new state');
    expect(afterTopic.topics.map((t) => t.name)).toContain('Brand new topic');
  });
});

describe('admin polling', () => {
  it('returns "unchanged" until something in the game changes', async () => {
    const { deps, gameId } = await setup();
    const first = await getGameIfChanged(deps, OWNER, gameId, undefined);
    if ('unchanged' in first) throw new Error('expected full details');

    expect(await getGameIfChanged(deps, OWNER, gameId, first.version)).toEqual({ unchanged: true, version: first.version });

    await addParticipants(deps, OWNER, gameId, { text: 'Olena Shevchenko' });
    const changed = await getGameIfChanged(deps, OWNER, gameId, first.version);
    if ('unchanged' in changed) throw new Error('expected full details');
    expect(changed.participants).toHaveLength(3);

    await updateGame(deps, OWNER, gameId, { name: 'Renamed' });
    const renamed = await getGameIfChanged(deps, OWNER, gameId, changed.version);
    if ('unchanged' in renamed) throw new Error('expected full details');
    expect(renamed.name).toBe('Renamed');
  });

  it('does not leak other admins\' games through polling', async () => {
    const { deps, gameId } = await setup();
    await expect(getGameIfChanged(deps, 'someone-else', gameId, 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe('sinceParam', () => {
  const request = (query: string) => new HttpRequest({ url: `http://localhost/api/x${query}`, method: 'GET' });

  it('reads a whole number and ignores anything else', () => {
    expect(sinceParam(request('?since=12'))).toBe(12);
    expect(sinceParam(request('?since=0'))).toBe(0);
    expect(sinceParam(request('?since=1792200000123456'))).toBe(1792200000123456);
    expect(sinceParam(request(''))).toBeUndefined();
    expect(sinceParam(request('?since=abc'))).toBeUndefined();
    expect(sinceParam(request('?since=-3'))).toBeUndefined();
    expect(sinceParam(request('?since=1.5'))).toBeUndefined();
  });
});
