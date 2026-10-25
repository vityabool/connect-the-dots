import { describe, expect, it } from 'vitest';
import { createGame, deleteGame, getGame, updateGame } from './games';
import { joinGame } from './play';
import { makeDeps } from './testing';

const ANNA = 'owner-anna';
const BOB = 'owner-bob';
const DAY = 24 * 60 * 60 * 1000;

/** Anna's game A expires, and Bob's game B gets the same 6-digit code afterwards. */
async function setup() {
  const ctx = makeDeps({ codes: ['111111', '111111'] });
  const a = await createGame(ctx.deps, ANNA, 'Old game');
  ctx.advanceDays(4);
  const b = await createGame(ctx.deps, BOB, 'New game');
  expect(b.code).toBe('111111'); // the code was reused
  return { ...ctx, a, b };
}

const joinsB = async (deps: Parameters<typeof joinGame>[0], b: { id: string }) => {
  const joined = await joinGame(deps, 'secret', '111111', `ip-${Math.random()}`);
  return joined.game.id === b.id;
};

describe('a reused game code stays with the game that holds it', () => {
  it('deleting the old expired game does not break the new game\'s code', async () => {
    const { deps, a, b } = await setup();
    await deleteGame(deps, ANNA, a.id);
    expect(await joinsB(deps, b)).toBe(true);
  });

  it('extending the old expired game does not steal the code from the new game', async () => {
    const { deps, a, b } = await setup();
    await updateGame(deps, ANNA, a.id, { expiresAt: new Date(deps.now().getTime() + DAY).toISOString() });
    expect(await joinsB(deps, b)).toBe(true);
  });

  it('the extended old game gets a new code of its own and can be joined with it', async () => {
    const { deps, a } = await setup();
    await updateGame(deps, ANNA, a.id, { expiresAt: new Date(deps.now().getTime() + DAY).toISOString() });
    const reopened = await getGame(deps, ANNA, a.id);
    expect(reopened.expired).toBe(false);
    expect(reopened.code).not.toBe('111111');
    const joined = await joinGame(deps, 'secret', reopened.code, 'ip-x');
    expect(joined.game.id).toBe(a.id);
  });

  it('the new code is shown in the admin\'s game list too', async () => {
    const { deps, a } = await setup();
    await updateGame(deps, ANNA, a.id, { expiresAt: new Date(deps.now().getTime() + DAY).toISOString() });
    const details = await getGame(deps, ANNA, a.id);
    const { listGames } = await import('./games');
    expect((await listGames(deps, ANNA))[0]?.code).toBe(details.code);
  });

  it('keeps its own code when extended while nobody else uses it', async () => {
    const ctx = makeDeps({ codes: ['222222'] });
    const game = await createGame(ctx.deps, ANNA, 'Solo');
    ctx.advanceDays(4);
    await updateGame(ctx.deps, ANNA, game.id, { expiresAt: new Date(ctx.deps.now().getTime() + DAY).toISOString() });
    expect((await getGame(ctx.deps, ANNA, game.id)).code).toBe('222222');
    await expect(joinGame(ctx.deps, 'secret', '222222', 'ip-y')).resolves.toBeDefined();
  });

  it('deleting a game frees its own code', async () => {
    const ctx = makeDeps({ codes: ['333333', '333333'] });
    const game = await createGame(ctx.deps, ANNA, 'Short lived');
    await deleteGame(ctx.deps, ANNA, game.id);
    const next = await createGame(ctx.deps, BOB, 'Next');
    expect(next.code).toBe('333333');
  });
});
