import { nameKey } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { createGame, getGame } from './games';
import { addParticipants } from './participants';
import { authenticate, authenticateIdentified, createConnection, getPlayState, joinGame, pickIdentity } from './play';
import { makeDeps } from './testing';
import { addTopics } from './topics';

const SECRET = 'test-secret';
const OWNER = 'owner-anna';

async function setup() {
  const ctx = makeDeps({ codes: ['123456'] });
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  await addParticipants(ctx.deps, OWNER, game.id, { text: 'Anna Koval\nIvan Petrenko' });
  await addTopics(ctx.deps, OWNER, game.id, { text: 'Have dogs' });
  const topic = (await getGame(ctx.deps, OWNER, game.id)).topics[0];
  async function player(name: string) {
    const joined = await joinGame(ctx.deps, SECRET, '123456', `ip-${name}`);
    const anon = await authenticate(ctx.deps, SECRET, joined.token);
    const picked = await pickIdentity(ctx.deps, SECRET, anon, nameKey(name));
    return authenticateIdentified(ctx.deps, SECRET, picked.token);
  }
  return { ...ctx, gameId: game.id, topicId: topic?.id ?? '', player };
}

describe('game version', () => {
  it('changes with every write, even when the clock does not move', async () => {
    const { deps, gameId, player, topicId } = await setup();
    const seen = new Set<number>([(await getGame(deps, OWNER, gameId)).version]);
    const anna = await player('Anna Koval');
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId });
    seen.add((await getGame(deps, OWNER, gameId)).version);
    await addParticipants(deps, OWNER, gameId, { text: 'Olena Shevchenko' });
    seen.add((await getGame(deps, OWNER, gameId)).version);
    await addTopics(deps, OWNER, gameId, { text: 'Tennis' });
    seen.add((await getGame(deps, OWNER, gameId)).version);
    expect(seen.size).toBe(4);
  });

  it('keeps increasing for a single writer', async () => {
    const { deps, gameId } = await setup();
    let previous = (await getGame(deps, OWNER, gameId)).version;
    for (let i = 0; i < 5; i += 1) {
      await addTopics(deps, OWNER, gameId, { text: `Topic ${i}` });
      const next = (await getGame(deps, OWNER, gameId)).version;
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });
});

describe('connections that lost their topic or person in a race with the admin', () => {
  it('are ignored by the player and admin views', async () => {
    const { deps, tables, gameId, player, topicId } = await setup();
    const anna = await player('Anna Koval');
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId });
    expect((await getPlayState(deps, anna)).connections).toHaveLength(1);

    // The topic disappears while the connection row is still there.
    await tables.delete('Topics', gameId, topicId);
    expect((await getPlayState(deps, anna)).connections).toHaveLength(0);
    expect((await getGame(deps, OWNER, gameId)).connections).toHaveLength(0);
  });

  it('are ignored when the other person was removed', async () => {
    const { deps, tables, gameId, player, topicId } = await setup();
    const anna = await player('Anna Koval');
    await createConnection(deps, anna, { otherId: nameKey('Ivan Petrenko'), topicId });
    await tables.delete('Participants', gameId, nameKey('Ivan Petrenko'));
    expect((await getPlayState(deps, anna)).connections).toHaveLength(0);
    expect((await getGame(deps, OWNER, gameId)).connections).toHaveLength(0);
  });
});
