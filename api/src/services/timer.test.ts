import { describe, expect, it } from 'vitest';
import { createGame, getGame, updateGame } from './games';
import { controlTimer } from './timer';
import { makeDeps } from './testing';

const OWNER = 'owner-anna';
const OTHER = 'owner-bob';
const MINUTE = 1 / (24 * 60); // advanceDays works in days

async function setup() {
  const ctx = makeDeps();
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  return { ...ctx, gameId: game.id };
}

describe('settings', () => {
  it('starts with sensible defaults', async () => {
    const { deps, gameId } = await setup();
    const game = await getGame(deps, OWNER, gameId);
    expect(game.settings).toEqual({ shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false });
    expect(game.timer).toEqual({ state: 'idle', minutes: 30, remainingSec: 1800 });
  });

  it('saves the short URL, rules, timer length and names toggle', async () => {
    const { deps, gameId } = await setup();
    await updateGame(deps, OWNER, gameId, {
      shortUrl: ' aka.ms/connect ',
      rulesText: '  Talk to people.  ',
      timerMinutes: 45,
      showNames: true,
    });
    const game = await getGame(deps, OWNER, gameId);
    expect(game.settings).toEqual({
      shortUrl: 'aka.ms/connect',
      rulesText: 'Talk to people.',
      timerMinutes: 45,
      showNames: true,
    });
    expect(game.timer.remainingSec).toBe(45 * 60);
  });

  it('accepts addresses with or without https and an empty value to clear it', async () => {
    const { deps, gameId } = await setup();
    await updateGame(deps, OWNER, gameId, { shortUrl: 'https://aka.ms/x' });
    expect((await getGame(deps, OWNER, gameId)).settings.shortUrl).toBe('https://aka.ms/x');
    await updateGame(deps, OWNER, gameId, { shortUrl: '' });
    expect((await getGame(deps, OWNER, gameId)).settings.shortUrl).toBe('');
  });

  it('rejects things that are not web addresses', async () => {
    const { deps, gameId } = await setup();
    for (const bad of ['javascript:alert(1)', 'ftp://example.com', 'not a url', 'localhost', 5]) {
      await expect(updateGame(deps, OWNER, gameId, { shortUrl: bad })).rejects.toMatchObject({ status: 400 });
    }
  });

  it('validates rules, timer length and the names toggle', async () => {
    const { deps, gameId } = await setup();
    await expect(updateGame(deps, OWNER, gameId, { rulesText: 'x'.repeat(1001) })).rejects.toMatchObject({ status: 400 });
    await expect(updateGame(deps, OWNER, gameId, { rulesText: 5 })).rejects.toMatchObject({ status: 400 });
    for (const bad of [0, 241, 1.5, '30', null]) {
      await expect(updateGame(deps, OWNER, gameId, { timerMinutes: bad })).rejects.toMatchObject({ status: 400 });
    }
    await expect(updateGame(deps, OWNER, gameId, { showNames: 'yes' })).rejects.toMatchObject({ status: 400 });
  });

  it('does not change the timer length while the timer is running', async () => {
    const { deps, gameId } = await setup();
    await controlTimer(deps, OWNER, gameId, 'start');
    await expect(updateGame(deps, OWNER, gameId, { timerMinutes: 10 })).rejects.toMatchObject({ status: 409 });
    await controlTimer(deps, OWNER, gameId, 'reset');
    await expect(updateGame(deps, OWNER, gameId, { timerMinutes: 10 })).resolves.toBeDefined();
  });
});

describe('controlTimer', () => {
  it('counts down from the start time', async () => {
    const { deps, gameId, advanceDays } = await setup();
    const started = await controlTimer(deps, OWNER, gameId, 'start');
    expect(started).toEqual({ state: 'running', minutes: 30, remainingSec: 1800 });

    advanceDays(10 * MINUTE);
    expect((await getGame(deps, OWNER, gameId)).timer).toMatchObject({ state: 'running', remainingSec: 1200 });
  });

  it('stays running at zero after the time is up (the game does not stop)', async () => {
    const { deps, gameId, advanceDays } = await setup();
    await controlTimer(deps, OWNER, gameId, 'start');
    advanceDays(31 * MINUTE);
    expect((await getGame(deps, OWNER, gameId)).timer).toEqual({ state: 'running', minutes: 30, remainingSec: 0 });
  });

  it('pauses, keeps the remaining time, and resumes from it', async () => {
    const { deps, gameId, advanceDays } = await setup();
    await controlTimer(deps, OWNER, gameId, 'start');
    advanceDays(5 * MINUTE);
    const paused = await controlTimer(deps, OWNER, gameId, 'pause');
    expect(paused).toEqual({ state: 'paused', minutes: 30, remainingSec: 1500 });

    advanceDays(20 * MINUTE); // time passes while paused
    expect((await getGame(deps, OWNER, gameId)).timer.remainingSec).toBe(1500);

    await controlTimer(deps, OWNER, gameId, 'start');
    advanceDays(10 * MINUTE);
    expect((await getGame(deps, OWNER, gameId)).timer).toMatchObject({ state: 'running', remainingSec: 900 });
  });

  it('resets to the full length', async () => {
    const { deps, gameId, advanceDays } = await setup();
    await controlTimer(deps, OWNER, gameId, 'start');
    advanceDays(5 * MINUTE);
    expect(await controlTimer(deps, OWNER, gameId, 'reset')).toEqual({ state: 'idle', minutes: 30, remainingSec: 1800 });
  });

  it('ignores a second start and a pause when not running', async () => {
    const { deps, gameId, advanceDays } = await setup();
    expect((await controlTimer(deps, OWNER, gameId, 'pause')).state).toBe('idle');
    await controlTimer(deps, OWNER, gameId, 'start');
    advanceDays(5 * MINUTE);
    const again = await controlTimer(deps, OWNER, gameId, 'start');
    expect(again.remainingSec).toBe(1500); // not restarted
  });

  it('bumps the game version so screens refresh', async () => {
    const { deps, gameId } = await setup();
    const before = (await getGame(deps, OWNER, gameId)).version;
    await controlTimer(deps, OWNER, gameId, 'start');
    expect((await getGame(deps, OWNER, gameId)).version).toBeGreaterThan(before);
  });

  it('rejects unknown actions and other admins', async () => {
    const { deps, gameId } = await setup();
    await expect(controlTimer(deps, OWNER, gameId, 'explode')).rejects.toMatchObject({ status: 400 });
    await expect(controlTimer(deps, OTHER, gameId, 'start')).rejects.toMatchObject({ status: 404 });
  });
});
