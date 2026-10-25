import { nameKey } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { adminDeleteConnection } from './connections';
import { createGame, getGame } from './games';
import { addParticipants } from './participants';
import { authenticate, authenticateIdentified, createConnection, getPlayState, joinGame, pickIdentity } from './play';
import { makeDeps } from './testing';
import { DEFAULT_TOPICS } from '@ctd/shared';
import { addTopics, deleteTopic, mergeTopics } from './topics';

/** The topics a test added itself (every new game also starts with the default topics). */
const custom = (names: string[]) => names.filter((name) => !DEFAULT_TOPICS.includes(name));

const SECRET = 'test-secret';
const OWNER = 'owner-anna';
const OTHER = 'owner-bob';

async function setup() {
  const ctx = makeDeps({ codes: ['123456'] });
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  await addParticipants(ctx.deps, OWNER, game.id, { text: 'Anna Koval\nIvan Petrenko\nOlena Shevchenko' });
  await addTopics(ctx.deps, OWNER, game.id, { text: 'Dogs\nHave dogs\nTennis' });
  const topicId = async (name: string) =>
    (await getGame(ctx.deps, OWNER, game.id)).topics.find((t) => t.name === name)?.id ?? '';

  async function player(name: string) {
    const joined = await joinGame(ctx.deps, SECRET, '123456', `ip-${name}`);
    const anon = await authenticate(ctx.deps, SECRET, joined.token);
    const picked = await pickIdentity(ctx.deps, SECRET, anon, nameKey(name));
    return authenticateIdentified(ctx.deps, SECRET, picked.token);
  }
  async function connect(from: string, to: string, topicName: string) {
    return createConnection(ctx.deps, await player(from), { otherId: nameKey(to), topicId: await topicId(topicName) });
  }
  return { ...ctx, gameId: game.id, topicId, player, connect };
}

describe('admin connection list', () => {
  it('lists all connections with names, newest first', async () => {
    const { deps, gameId, connect, advanceDays } = await setup();
    await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    advanceDays(0.001);
    await connect('Ivan Petrenko', 'Olena Shevchenko', 'Tennis');

    const { connections } = await getGame(deps, OWNER, gameId);
    expect(connections.map((c) => `${c.aName}|${c.bName}|${c.topicName}`)).toEqual([
      'Ivan Petrenko|Olena Shevchenko|Tennis',
      'Anna Koval|Ivan Petrenko|Dogs',
    ]);
  });
});

describe('adminDeleteConnection', () => {
  it('lets the admin delete any connection', async () => {
    const { deps, gameId, connect, player } = await setup();
    const created = await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    await adminDeleteConnection(deps, OWNER, gameId, created.id);
    expect((await getPlayState(deps, await player('Ivan Petrenko'))).connections).toHaveLength(0);
    expect((await getGame(deps, OWNER, gameId)).connections).toHaveLength(0);
  });

  it('answers 404 for unknown connections and for other admins', async () => {
    const { deps, gameId, connect } = await setup();
    const created = await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    await expect(adminDeleteConnection(deps, OWNER, gameId, 'nope')).rejects.toMatchObject({ status: 404 });
    await expect(adminDeleteConnection(deps, OTHER, gameId, created.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteTopic', () => {
  it('deletes the topic and only the connections made on it', async () => {
    const { deps, gameId, topicId, connect } = await setup();
    await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    await connect('Anna Koval', 'Olena Shevchenko', 'Dogs');
    await connect('Anna Koval', 'Ivan Petrenko', 'Tennis');

    const result = await deleteTopic(deps, OWNER, gameId, await topicId('Dogs'));
    expect(result).toEqual({ deletedConnections: 2 });

    const game = await getGame(deps, OWNER, gameId);
    expect(custom(game.topics.map((t) => t.name))).toEqual(['Have dogs', 'Tennis']);
    expect(game.connections.map((c) => c.topicName)).toEqual(['Tennis']);
  });

  it('answers 404 for unknown topics and other admins', async () => {
    const { deps, gameId, topicId } = await setup();
    await expect(deleteTopic(deps, OWNER, gameId, 'missing')).rejects.toMatchObject({ status: 404 });
    await expect(deleteTopic(deps, OTHER, gameId, await topicId('Dogs'))).rejects.toMatchObject({ status: 404 });
  });

  it('lets players recreate the topic later', async () => {
    const { deps, gameId, topicId, player } = await setup();
    await deleteTopic(deps, OWNER, gameId, await topicId('Tennis'));
    const anna = await player('Anna Koval');
    await expect(
      createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), newTopicName: 'Tennis' }),
    ).resolves.toBeDefined();
  });
});

describe('mergeTopics', () => {
  it('moves connections from the source to the target and removes the source', async () => {
    const { deps, gameId, topicId, connect } = await setup();
    await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    await connect('Anna Koval', 'Olena Shevchenko', 'Dogs');
    await connect('Ivan Petrenko', 'Olena Shevchenko', 'Have dogs');

    const result = await mergeTopics(deps, OWNER, gameId, await topicId('Dogs'), await topicId('Have dogs'));
    expect(result).toEqual({ moved: 2, duplicatesDropped: 0 });

    const game = await getGame(deps, OWNER, gameId);
    expect(custom(game.topics.map((t) => t.name))).toEqual(['Have dogs', 'Tennis']);
    expect(game.connections).toHaveLength(3);
    expect(game.connections.every((c) => c.topicName === 'Have dogs')).toBe(true);
  });

  it('keeps one connection when the pair already shares the target topic', async () => {
    const { deps, gameId, topicId, connect } = await setup();
    await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    await connect('Ivan Petrenko', 'Anna Koval', 'Have dogs');

    const result = await mergeTopics(deps, OWNER, gameId, await topicId('Dogs'), await topicId('Have dogs'));
    expect(result).toEqual({ moved: 0, duplicatesDropped: 1 });
    expect((await getGame(deps, OWNER, gameId)).connections).toHaveLength(1);
  });

  it('validates input and ownership', async () => {
    const { deps, gameId, topicId } = await setup();
    const dogs = await topicId('Dogs');
    await expect(mergeTopics(deps, OWNER, gameId, dogs, dogs)).rejects.toMatchObject({ status: 400 });
    await expect(mergeTopics(deps, OWNER, gameId, dogs, undefined)).rejects.toMatchObject({ status: 400 });
    await expect(mergeTopics(deps, OWNER, gameId, dogs, 'missing')).rejects.toMatchObject({ status: 404 });
    await expect(mergeTopics(deps, OTHER, gameId, dogs, await topicId('Tennis'))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('players see the merged topic name on their connections', async () => {
    const { deps, gameId, topicId, connect, player } = await setup();
    await connect('Anna Koval', 'Ivan Petrenko', 'Dogs');
    await mergeTopics(deps, OWNER, gameId, await topicId('Dogs'), await topicId('Have dogs'));
    const state = await getPlayState(deps, await player('Ivan Petrenko'));
    expect(state.connections[0]?.topicName).toBe('Have dogs');
  });
});
