import { nameKey } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { createGame, getGame, updateGame } from './games';
import { addParticipants } from './participants';
import {
  authenticate,
  authenticateIdentified,
  createConnection,
  deleteConnection,
  getPlayState,
  joinGame,
  pickIdentity,
} from './play';
import { makeDeps } from './testing';
import { addTopics } from './topics';

const SECRET = 'test-secret';
const OWNER = 'owner-anna';

async function setup() {
  const ctx = makeDeps({ codes: ['123456'] });
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  await addParticipants(ctx.deps, OWNER, game.id, { text: 'Anna Koval\nIvan Petrenko\nOlena Shevchenko' });
  await addTopics(ctx.deps, OWNER, game.id, { text: 'Have dogs\nPlay tennis' });

  /** Joins as the named person and returns an identified context, like a real player's request. */
  async function player(name: string) {
    const joined = await joinGame(ctx.deps, SECRET, '123456', `ip-${name}`);
    const anon = await authenticate(ctx.deps, SECRET, joined.token);
    const picked = await pickIdentity(ctx.deps, SECRET, anon, nameKey(name));
    return { ...(await authenticateIdentified(ctx.deps, SECRET, picked.token)), token: picked.token };
  }

  return { ...ctx, gameId: game.id, player };
}

describe('joinGame', () => {
  it('lets a player in with the code and lists the participants', async () => {
    const { deps, gameId } = await setup();
    const result = await joinGame(deps, SECRET, '123456', 'ip1');
    expect(result.game).toEqual({ id: gameId, name: 'Offsite' });
    expect(result.participants.map((p) => p.name)).toEqual(['Anna Koval', 'Ivan Petrenko', 'Olena Shevchenko']);
    expect(result.token).toContain('.');
  });

  it('rejects unknown and malformed codes', async () => {
    const { deps } = await setup();
    await expect(joinGame(deps, SECRET, '999999', 'ip1')).rejects.toMatchObject({ status: 404 });
    await expect(joinGame(deps, SECRET, 'abc', 'ip1')).rejects.toMatchObject({ status: 404 });
    await expect(joinGame(deps, SECRET, undefined, 'ip1')).rejects.toMatchObject({ status: 404 });
  });

  it('blocks a client after too many wrong codes, but not other clients', async () => {
    const { deps } = await setup();
    for (let i = 0; i < 10; i += 1) {
      await expect(joinGame(deps, SECRET, '000000', 'guesser')).rejects.toMatchObject({ status: 404 });
    }
    await expect(joinGame(deps, SECRET, '123456', 'guesser')).rejects.toMatchObject({ status: 429 });
    await expect(joinGame(deps, SECRET, '123456', 'someone-else')).resolves.toBeDefined();
  });

  it('unblocks after the 10-minute window', async () => {
    const { deps, advanceDays } = await setup();
    for (let i = 0; i < 10; i += 1) await joinGame(deps, SECRET, '000000', 'guesser').catch(() => undefined);
    advanceDays(0.01); // ~14 minutes
    await expect(joinGame(deps, SECRET, '123456', 'guesser')).resolves.toBeDefined();
  });

  it('says the game has ended once it expired', async () => {
    const { deps, advanceDays } = await setup();
    advanceDays(4);
    await expect(joinGame(deps, SECRET, '123456', 'ip1')).rejects.toMatchObject({ status: 410 });
  });
});

describe('authentication', () => {
  it('rejects missing or forged tokens', async () => {
    const { deps } = await setup();
    await expect(authenticate(deps, SECRET, null)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate(deps, SECRET, 'x.y')).rejects.toMatchObject({ status: 401 });
  });

  it('requires an identity for identified requests', async () => {
    const { deps } = await setup();
    const joined = await joinGame(deps, SECRET, '123456', 'ip1');
    await expect(authenticateIdentified(deps, SECRET, joined.token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects picking someone who is not in the game', async () => {
    const { deps } = await setup();
    const joined = await joinGame(deps, SECRET, '123456', 'ip1');
    const anon = await authenticate(deps, SECRET, joined.token);
    await expect(pickIdentity(deps, SECRET, anon, 'nobody')).rejects.toMatchObject({ status: 404 });
    await expect(pickIdentity(deps, SECRET, anon, undefined)).rejects.toMatchObject({ status: 400 });
  });

  it('stops working when the game expires, and again when the admin extends it', async () => {
    const { deps, advanceDays, gameId } = await setup();
    const joined = await joinGame(deps, SECRET, '123456', 'ip1');
    advanceDays(4);
    await expect(authenticate(deps, SECRET, joined.token)).rejects.toMatchObject({ status: 410 });

    const extended = new Date(deps.now().getTime() + 24 * 60 * 60 * 1000).toISOString();
    await updateGame(deps, OWNER, gameId, { expiresAt: extended });
    await expect(authenticate(deps, SECRET, joined.token)).resolves.toBeDefined();
  });

  it('asks the player to pick a name again when the admin removed them', async () => {
    const { deps, tables, gameId, player } = await setup();
    const anna = await player('Anna Koval');
    await expect(authenticateIdentified(deps, SECRET, anna.token)).resolves.toBeDefined();
    await tables.delete('Participants', gameId, anna.me.id);
    await expect(authenticateIdentified(deps, SECRET, anna.token)).rejects.toMatchObject({ status: 401 });
  });
});

describe('createConnection', () => {
  it('connects two people on an existing topic', async () => {
    const { deps, gameId, player } = await setup();
    const anna = await player('Anna Koval');
    const topics = (await getGame(deps, OWNER, gameId)).topics;
    const dogs = topics.find((t) => t.name === 'Have dogs');

    const connection = await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId: dogs?.id });
    expect(connection).toMatchObject({ otherName: 'Ivan Petrenko', topicName: 'Have dogs', createdByMe: true });
  });

  it('creates a new topic on the fly and makes it available to everyone', async () => {
    const { deps, gameId, player } = await setup();
    const anna = await player('Anna Koval');
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), newTopicName: '  Rock   climbing ' });

    const topics = (await getGame(deps, OWNER, gameId)).topics.map((t) => t.name);
    expect(topics).toContain('Rock climbing');
    const olena = await player('Olena Shevchenko');
    expect((await getPlayState(deps, olena)).topics.map((t) => t.name)).toContain('Rock climbing');
  });

  it('reuses an existing topic when a new name matches it ignoring case', async () => {
    const { deps, gameId, player } = await setup();
    const anna = await player('Anna Koval');
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), newTopicName: 'HAVE DOGS' });
    const names = (await getGame(deps, OWNER, gameId)).topics.map((t) => t.name);
    expect(names.filter((n) => n.toLowerCase() === 'have dogs')).toEqual(['Have dogs']);
  });

  it('rejects connecting with yourself, unknown people and missing input', async () => {
    const { deps, player } = await setup();
    const anna = await player('Anna Koval');
    await expect(createConnection(deps, anna, { otherId: anna.me.id, newTopicName: 'x' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(createConnection(deps, anna, { otherId: 'ghost', newTopicName: 'x' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(createConnection(deps, anna, {})).rejects.toMatchObject({ status: 400 });
    await expect(createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko') })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId: 'does-not-exist' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('allows the same pair on different topics but not twice on the same topic (either direction)', async () => {
    const { deps, player } = await setup();
    const anna = await player('Anna Koval');
    const ivan = await player('Ivan Petrenko');
    await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Have dogs' });
    await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Play tennis' });

    await expect(
      createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'have dogs' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      createConnection(deps, ivan, { otherId: anna.me.id, newTopicName: 'Have dogs' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('getPlayState', () => {
  it('shows a player only their own connections', async () => {
    const { deps, player } = await setup();
    const anna = await player('Anna Koval');
    const ivan = await player('Ivan Petrenko');
    const olena = await player('Olena Shevchenko');
    await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Have dogs' });
    await createConnection(deps, ivan, { otherId: olena.me.id, newTopicName: 'Play tennis' });

    const annaState = await getPlayState(deps, anna);
    expect(annaState.connections).toHaveLength(1);
    expect(annaState.connections[0]).toMatchObject({ otherName: 'Ivan Petrenko', createdByMe: true });

    const ivanState = await getPlayState(deps, ivan);
    expect(ivanState.connections.map((c) => c.otherName).sort()).toEqual(['Anna Koval', 'Olena Shevchenko']);
    expect(ivanState.connections.find((c) => c.otherName === 'Anna Koval')?.createdByMe).toBe(false);

    const olenaState = await getPlayState(deps, olena);
    expect(olenaState.connections).toHaveLength(1);
    expect(olenaState.me.name).toBe('Olena Shevchenko');
    expect(olenaState.participants).toHaveLength(3);
  });
});

describe('deleteConnection', () => {
  it('lets the creator and the other person delete, but nobody else', async () => {
    const { deps, player } = await setup();
    const anna = await player('Anna Koval');
    const ivan = await player('Ivan Petrenko');
    const olena = await player('Olena Shevchenko');

    const first = await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Have dogs' });
    await expect(deleteConnection(deps, olena, first.id)).rejects.toMatchObject({ status: 404 });
    await deleteConnection(deps, anna, first.id); // creator
    expect((await getPlayState(deps, ivan)).connections).toHaveLength(0);

    const second = await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Have dogs' });
    await deleteConnection(deps, ivan, second.id); // the person it was created with
    expect((await getPlayState(deps, anna)).connections).toHaveLength(0);
  });

  it('answers 404 for unknown connections', async () => {
    const { deps, player } = await setup();
    const anna = await player('Anna Koval');
    await expect(deleteConnection(deps, anna, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('frees the pair to connect again on that topic', async () => {
    const { deps, player } = await setup();
    const anna = await player('Anna Koval');
    const ivan = await player('Ivan Petrenko');
    const connection = await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Have dogs' });
    await deleteConnection(deps, anna, connection.id);
    await expect(
      createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'Have dogs' }),
    ).resolves.toBeDefined();
  });
});

describe('game row integrity', () => {
  it('keeps an admin rename even when players write with an older copy of the game', async () => {
    const { deps, gameId, player } = await setup();
    const anna = await player('Anna Koval'); // holds the game as it was before the rename
    await updateGame(deps, OWNER, gameId, { name: 'Renamed offsite' });

    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), newTopicName: 'Have dogs' });

    const game = await getGame(deps, OWNER, gameId);
    expect(game.name).toBe('Renamed offsite');
    expect(game.version).toBeGreaterThanOrEqual(4);
  });
});
