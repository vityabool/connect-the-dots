import { randomUUID } from 'node:crypto';
import { TableClient } from '@azure/data-tables';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TOPICS, nameKey } from '@ctd/shared';
import { createGame, deleteGame, defaultDeps, getGame, listGames, updateGame } from '../services/games';
import { addParticipants, deleteParticipant } from '../services/participants';
import {
  authenticate,
  authenticateIdentified,
  createConnection,
  deleteConnection,
  getPlayState,
  joinGame,
  pickIdentity,
} from '../services/play';
import { adminDeleteConnection } from '../services/connections';
import { runCleanup } from '../services/cleanup';
import { addTopics, deleteTopic, mergeTopics } from '../services/topics';
import { AzureTables } from './azureTables';
import { ConflictError, type TableName } from './tables';

// Runs only when TABLES_TEST_CONNECTION points at Azurite (CI and `npm run test:integration`).
const connection = process.env.TABLES_TEST_CONNECTION;
const TABLES: TableName[] = ['Games', 'GameCodes', 'OwnerGames', 'Participants', 'Topics', 'Connections', 'RateLimits'];

describe.skipIf(!connection)('AzureTables against Azurite', () => {
  const tables = new AzureTables(connection ?? '');

  beforeAll(async () => {
    for (const name of TABLES) {
      await TableClient.fromConnectionString(connection ?? '', name, { allowInsecureConnection: true })
        .createTable()
        .catch(() => undefined);
    }
  });

  it('inserts, reads, replaces and deletes a row', async () => {
    const pk = randomUUID();
    await tables.insert('Topics', { partitionKey: pk, rowKey: 'a', name: 'Dogs', count: 2, flag: true });
    expect(await tables.get('Topics', pk, 'a')).toEqual({
      partitionKey: pk,
      rowKey: 'a',
      name: 'Dogs',
      count: 2,
      flag: true,
    });

    await tables.upsert('Topics', { partitionKey: pk, rowKey: 'a', name: 'Cats' });
    expect(await tables.get('Topics', pk, 'a')).toEqual({ partitionKey: pk, rowKey: 'a', name: 'Cats' });

    await tables.delete('Topics', pk, 'a');
    expect(await tables.get('Topics', pk, 'a')).toBeUndefined();
    await expect(tables.delete('Topics', pk, 'a')).resolves.toBeUndefined();
  });

  it('refuses to insert the same keys twice', async () => {
    const pk = randomUUID();
    await tables.insert('Topics', { partitionKey: pk, rowKey: 'a', name: 'Dogs' });
    await expect(tables.insert('Topics', { partitionKey: pk, rowKey: 'a', name: 'Dogs' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('lists only the rows of one partition and deletes more than 100 of them', async () => {
    const pk = randomUUID();
    const other = randomUUID();
    await tables.insert('Participants', { partitionKey: other, rowKey: 'keep', name: 'Keep me' });
    for (let i = 0; i < 130; i += 1) {
      await tables.insert('Participants', { partitionKey: pk, rowKey: `p${i}`, name: `Person ${i}` });
    }
    expect(await tables.list('Participants', pk)).toHaveLength(130);

    await tables.deletePartition('Participants', pk);
    expect(await tables.list('Participants', pk)).toEqual([]);
    expect(await tables.list('Participants', other)).toHaveLength(1);
  });

  it('merges only the given properties of a row', async () => {
    const pk = randomUUID();
    await tables.insert('Games', { partitionKey: pk, rowKey: 'game', name: 'Keep', version: 1 });
    await tables.merge('Games', { partitionKey: pk, rowKey: 'game', version: 2 });
    expect(await tables.get('Games', pk, 'game')).toEqual({ partitionKey: pk, rowKey: 'game', name: 'Keep', version: 2 });
  });

  it('runs a whole game: players join, connect, delete; admin edits survive', async () => {
    const deps = defaultDeps(tables);
    const secret = 'integration-secret';
    const owner = `owner-${randomUUID()}`;

    const game = await createGame(deps, owner, 'Play flow');
    await addParticipants(deps, owner, game.id, { text: 'Anna Koval\nIvan Petrenko' });
    await addTopics(deps, owner, game.id, { text: 'Have dogs' });

    const asPlayer = async (name: string) => {
      const joined = await joinGame(deps, secret, game.code, `ip-${randomUUID()}`);
      const anon = await authenticate(deps, secret, joined.token);
      const picked = await pickIdentity(deps, secret, anon, nameKey(name));
      return authenticateIdentified(deps, secret, picked.token);
    };
    const anna = await asPlayer('Anna Koval');
    const ivan = await asPlayer('Ivan Petrenko');

    await updateGame(deps, owner, game.id, { name: 'Renamed while playing' });
    const connection = await createConnection(deps, anna, { otherId: ivan.me.id, newTopicName: 'have DOGS' });
    expect(connection.topicName).toBe('Have dogs');
    await expect(createConnection(deps, ivan, { otherId: anna.me.id, newTopicName: 'Have dogs' })).rejects.toMatchObject({
      status: 409,
    });

    expect((await getPlayState(deps, ivan)).connections).toHaveLength(1);
    expect((await getGame(deps, owner, game.id)).name).toBe('Renamed while playing');

    await deleteConnection(deps, ivan, connection.id);
    expect((await getPlayState(deps, anna)).connections).toHaveLength(0);

    await deleteGame(deps, owner, game.id);
    await expect(joinGame(deps, secret, game.code, `ip-${randomUUID()}`)).rejects.toMatchObject({ status: 404 });
  });

  it('merges and deletes topics with their connections', async () => {
    const deps = defaultDeps(tables);
    const owner = `owner-${randomUUID()}`;
    const game = await createGame(deps, owner, 'Topic management');
    await addParticipants(deps, owner, game.id, { text: 'Anna Koval\nIvan Petrenko\nOlena Shevchenko' });
    await addTopics(deps, owner, game.id, { text: 'Dogs\nHave dogs\nTennis' });
    const topics = (await getGame(deps, owner, game.id)).topics;
    const id = (name: string) => topics.find((t) => t.name === name)?.id ?? '';

    const joined = await joinGame(deps, 'secret', game.code, `ip-${randomUUID()}`);
    const anon = await authenticate(deps, 'secret', joined.token);
    const picked = await pickIdentity(deps, 'secret', anon, nameKey('Anna Koval'));
    const anna = await authenticateIdentified(deps, 'secret', picked.token);
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId: id('Dogs') });
    await createConnection(deps, anna, { otherId: nameKey('Olena Shevchenko'), topicId: id('Dogs') });
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId: id('Have dogs') });
    await createConnection(deps, anna, { otherId: nameKey('Olena Shevchenko'), topicId: id('Tennis') });

    expect(await mergeTopics(deps, owner, game.id, id('Dogs'), id('Have dogs'))).toEqual({
      moved: 1,
      duplicatesDropped: 1,
    });
    expect(await deleteTopic(deps, owner, game.id, id('Tennis'))).toEqual({ deletedConnections: 1 });

    const after = await getGame(deps, owner, game.id);
    // The merged topic is the only one left of the three added here; the default topics of every new game are still there.
    expect(after.topics.map((t) => t.name).filter((name) => !DEFAULT_TOPICS.includes(name))).toEqual(['Have dogs']);
    expect(after.topics).toHaveLength(DEFAULT_TOPICS.length + 1);
    expect(after.connections.map((c) => `${c.bName}:${c.topicName}`).sort()).toEqual([
      'Ivan Petrenko:Have dogs',
      'Olena Shevchenko:Have dogs',
    ]);
    await adminDeleteConnection(deps, owner, game.id, after.connections[0]?.id ?? '');
    expect((await getGame(deps, owner, game.id)).connections).toHaveLength(1);
    await deleteGame(deps, owner, game.id);
  });

  // The cleanup deletes EVERY game that is old enough, so this only runs against the local emulator
  // (or a throwaway account when TABLES_TEST_ALLOW_CLEANUP=1) and never against real data.
  it.skipIf(!(connection?.includes('UseDevelopmentStorage=true') || process.env.TABLES_TEST_ALLOW_CLEANUP === '1'))(
    'scans a table and the cleanup deletes only games that expired more than 30 days ago',
    async () => {
    const real = defaultDeps(tables);
    const owner = `owner-${randomUUID()}`;
    const old = await createGame(real, owner, 'Will be deleted');
    const fresh = await createGame(real, owner, 'Stays');
    await addParticipants(real, owner, old.id, { text: 'Anna Koval' });

    expect((await tables.scan('Games')).some((row) => row.partitionKey === old.id)).toBe(true);

    // Look at the data as if 40 days had passed, but only for the old game: age it by moving its expiry back.
    await tables.merge('Games', { partitionKey: old.id, rowKey: 'game', expiresAt: new Date(Date.now() - 31 * 86_400_000).toISOString() });
    const result = await runCleanup(real);
    expect(result.gamesDeleted).toBeGreaterThanOrEqual(1);

    expect(await tables.get('Games', old.id, 'game')).toBeUndefined();
    expect(await tables.list('Participants', old.id)).toEqual([]);
    expect(await tables.get('Games', fresh.id, 'game')).toBeDefined();
    await deleteGame(real, owner, fresh.id);
    },
  );

  it('runs the game lifecycle end to end', async () => {
    const deps = defaultDeps(tables);
    const owner = `owner-${randomUUID()}`;

    const game = await createGame(deps, owner, 'Integration game');
    expect(game.code).toMatch(/^\d{6}$/);

    const added = await addParticipants(deps, owner, game.id, { text: 'Anna Koval\nIvan Petrenko\nanna koval' });
    expect(added.added).toHaveLength(2);
    expect(added.duplicatesSkipped).toBe(1);

    const details = await getGame(deps, owner, game.id);
    expect(details.participants.map((p) => p.name)).toEqual(['Anna Koval', 'Ivan Petrenko']);

    await deleteParticipant(deps, owner, game.id, details.participants[0]?.id ?? '');
    expect((await getGame(deps, owner, game.id)).participants).toHaveLength(1);

    await deleteGame(deps, owner, game.id);
    expect(await listGames(deps, owner)).toEqual([]);
    expect(await tables.get('Games', game.id, 'game')).toBeUndefined();
    expect(await tables.list('Participants', game.id)).toEqual([]);
  });
});
