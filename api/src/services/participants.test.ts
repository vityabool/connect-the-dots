import { nameKey } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { createGame, getGame } from './games';
import { addParticipants, deleteParticipant } from './participants';
import { makeDeps } from './testing';

const ANNA = 'owner-anna';
const BOB = 'owner-bob';

async function setup() {
  const ctx = makeDeps();
  const game = await createGame(ctx.deps, ANNA, 'Offsite');
  return { ...ctx, gameId: game.id };
}

describe('addParticipants', () => {
  it('adds names from a .txt style list, ignoring blank lines', async () => {
    const { deps, gameId } = await setup();
    const result = await addParticipants(deps, ANNA, gameId, {
      text: 'Ivan Petrenko\n\nAnna Koval\r\n  Olena Shevchenko  \n',
    });
    expect(result.added.map((p) => p.name)).toEqual(['Anna Koval', 'Ivan Petrenko', 'Olena Shevchenko']);
    expect(result.duplicatesSkipped).toBe(0);
    expect((await getGame(deps, ANNA, gameId)).participants).toHaveLength(3);
  });

  it('never adds a name twice (inside the file or across uploads)', async () => {
    const { deps, gameId } = await setup();
    const first = await addParticipants(deps, ANNA, gameId, { text: 'Anna Koval\nanna koval\nIvan Petrenko' });
    expect(first.added).toHaveLength(2);
    expect(first.duplicatesSkipped).toBe(1);

    const second = await addParticipants(deps, ANNA, gameId, { names: ['ANNA  KOVAL', 'Olena Shevchenko'] });
    expect(second.added.map((p) => p.name)).toEqual(['Olena Shevchenko']);
    expect(second.duplicatesSkipped).toBe(1);
    expect((await getGame(deps, ANNA, gameId)).participants).toHaveLength(3);
  });

  it('uses the name key as participant id', async () => {
    const { deps, gameId } = await setup();
    const result = await addParticipants(deps, ANNA, gameId, { text: 'Anna Koval' });
    expect(result.added[0]?.id).toBe(nameKey('Anna Koval'));
  });

  it('skips names that are too long and reports them', async () => {
    const { deps, gameId } = await setup();
    const result = await addParticipants(deps, ANNA, gameId, { text: `${'x'.repeat(101)}\nAnna Koval` });
    expect(result.added.map((p) => p.name)).toEqual(['Anna Koval']);
    expect(result.tooLongSkipped).toBe(1);
  });

  it('refuses more than 200 participants', async () => {
    const { deps, gameId } = await setup();
    const names = Array.from({ length: 201 }, (_, i) => `Person ${i}`);
    await expect(addParticipants(deps, ANNA, gameId, { names })).rejects.toMatchObject({ status: 400 });
    expect((await getGame(deps, ANNA, gameId)).participants).toHaveLength(0);
  });

  it('requires text or names', async () => {
    const { deps, gameId } = await setup();
    await expect(addParticipants(deps, ANNA, gameId, {})).rejects.toMatchObject({ status: 400 });
    await expect(addParticipants(deps, ANNA, gameId, { names: [1, 2] })).rejects.toMatchObject({ status: 400 });
  });

  it('only works for the owner of the game', async () => {
    const { deps, gameId } = await setup();
    await expect(addParticipants(deps, BOB, gameId, { text: 'Anna Koval' })).rejects.toMatchObject({ status: 404 });
  });

  it('bumps the game version only when something was added', async () => {
    const { deps, gameId } = await setup();
    await addParticipants(deps, ANNA, gameId, { text: 'Anna Koval' });
    const afterAdd = (await getGame(deps, ANNA, gameId)).version;
    await addParticipants(deps, ANNA, gameId, { text: 'Anna Koval' });
    expect((await getGame(deps, ANNA, gameId)).version).toBe(afterAdd);
  });
});

describe('deleteParticipant', () => {
  it('removes the participant and every connection they are in', async () => {
    const { deps, tables, gameId } = await setup();
    const { added } = await addParticipants(deps, ANNA, gameId, { text: 'Anna Koval\nIvan Petrenko\nOlena Shevchenko' });
    const [anna, ivan, olena] = added;
    if (!anna || !ivan || !olena) throw new Error('setup failed');
    await tables.insert('Connections', { partitionKey: gameId, rowKey: 'c1', aId: anna.id, bId: ivan.id });
    await tables.insert('Connections', { partitionKey: gameId, rowKey: 'c2', aId: olena.id, bId: anna.id });
    await tables.insert('Connections', { partitionKey: gameId, rowKey: 'c3', aId: ivan.id, bId: olena.id });

    await deleteParticipant(deps, ANNA, gameId, anna.id);

    const rows = await tables.list('Connections', gameId);
    expect(rows.map((r) => r.rowKey)).toEqual(['c3']);
    expect((await getGame(deps, ANNA, gameId)).participants.map((p) => p.name)).toEqual([
      'Ivan Petrenko',
      'Olena Shevchenko',
    ]);
  });

  it('answers 404 for an unknown participant or a foreign game', async () => {
    const { deps, gameId } = await setup();
    await expect(deleteParticipant(deps, ANNA, gameId, 'missing')).rejects.toMatchObject({ status: 404 });
    const { added } = await addParticipants(deps, ANNA, gameId, { text: 'Anna Koval' });
    await expect(deleteParticipant(deps, BOB, gameId, added[0]?.id ?? '')).rejects.toMatchObject({ status: 404 });
  });
});
