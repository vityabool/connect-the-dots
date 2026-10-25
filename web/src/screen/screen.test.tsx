import type { GameDetails } from '@ctd/shared';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { formatClock, useCountdown } from './useCountdown';

const GAME_ID = 'a'.repeat(32);

function makeGame(overrides: Partial<GameDetails> = {}): GameDetails {
  const people = ['Anna', 'Ivan', 'Olena', 'Maksym'];
  return {
    id: GAME_ID,
    name: 'Leadership offsite',
    code: '123456',
    createdAt: '2026-10-17T09:00:00.000Z',
    expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    expired: false,
    participants: people.map((name) => ({ id: name.toLowerCase(), name })),
    topics: [{ id: 'dogs', name: 'Dogs' }],
    connections: [
      {
        id: 'c1',
        aId: 'anna',
        aName: 'Anna',
        bId: 'ivan',
        bName: 'Ivan',
        topicId: 'dogs',
        topicName: 'Dogs',
        createdBy: 'anna',
        createdAt: '2026-10-17T10:00:00.000Z',
      },
    ],
    settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
    timer: { state: 'idle', minutes: 30, remainingSec: 1800 },
    version: 1,
    ...overrides,
  };
}

let game: GameDetails;
let calls: { method: string; path: string; body?: unknown }[];
let shortLinkReply: ReturnType<typeof reply>;

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  game = makeGame();
  calls = [];
  shortLinkReply = reply(200, { shortUrl: 'is.gd/aB3x9Q' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const [route] = path.split('?');
      calls.push({ method, path: route ?? path, body });
      if (route === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
      if (route === `/api/manage/games/${GAME_ID}` && method === 'GET') return reply(200, game);
      if (route === `/api/manage/games/${GAME_ID}` && method === 'PATCH') {
        game = { ...game, settings: { ...game.settings, ...body }, version: game.version + 1 };
        return reply(200, {});
      }
      if (route === `/api/manage/games/${GAME_ID}/shortlink` && method === 'POST') {
        return shortLinkReply;
      }
      if (route === `/api/manage/games/${GAME_ID}/timer` && method === 'POST') {
        game = {
          ...game,
          timer:
            body.action === 'start'
              ? { state: 'running', minutes: 30, remainingSec: 1800 }
              : { state: 'idle', minutes: 30, remainingSec: 1800 },
          version: game.version + 1,
        };
        return reply(200, game.timer);
      }
      return reply(404, { error: 'Not found' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const openScreen = () =>
  render(
    <MemoryRouter initialEntries={[`/admin/games/${GAME_ID}/screen`]}>
      <App />
    </MemoryRouter>,
  );

const openGame = () =>
  render(
    <MemoryRouter initialEntries={[`/admin/games/${GAME_ID}`]}>
      <App />
    </MemoryRouter>,
  );

describe('formatClock', () => {
  it('formats minutes and seconds, and hours when needed', () => {
    expect(formatClock(1800)).toBe('30:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('useCountdown', () => {
  it('does not move while idle or paused', () => {
    const idle = renderHook(() => useCountdown({ state: 'idle', minutes: 30, remainingSec: 1800 }, Date.now()));
    expect(idle.result.current).toEqual({ remainingSec: 1800, state: 'idle', timeUp: false });
    const paused = renderHook(() => useCountdown({ state: 'paused', minutes: 30, remainingSec: 600 }, Date.now()));
    expect(paused.result.current).toMatchObject({ remainingSec: 600, state: 'paused', timeUp: false });
  });

  it('counts down while running and reports when time is up', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    const received = Date.now();
    const { result } = renderHook(() => useCountdown({ state: 'running', minutes: 1, remainingSec: 5 }, received));
    expect(result.current).toEqual({ remainingSec: 5, state: 'running', timeUp: false });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSec).toBe(3);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toEqual({ remainingSec: 0, state: 'running', timeUp: true });
  });
});

describe('Timer screen', () => {
  it('shows the countdown, default rules, join code, QR code, and the graph', async () => {
    openScreen();
    expect(await screen.findByRole('heading', { name: 'Leadership offsite' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('30:00');
    expect(screen.getByText('Not started yet')).toBeInTheDocument();
    expect(screen.getByText(/Walk around the room/)).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'QR code that opens the join page' })).toBeInTheDocument();
    expect(screen.getAllByTestId('dot')).toHaveLength(4);
    expect(screen.getAllByTestId('edge')).toHaveLength(1);
  });

  it('shows the facilitator\'s short link and rules instead of the defaults', async () => {
    game = makeGame({ settings: { shortUrl: 'aka.ms/connect', rulesText: 'Be kind.\nHave fun.', timerMinutes: 30, showNames: false } });
    openScreen();
    expect(await screen.findByText('aka.ms/connect')).toBeInTheDocument();
    expect(screen.getByText('Be kind.')).toBeInTheDocument();
    expect(screen.getByText('Have fun.')).toBeInTheDocument();
    expect(screen.queryByText(/Walk around the room/)).not.toBeInTheDocument();
  });

  it('hides names by default and shows them when the facilitator wants', async () => {
    openScreen();
    await screen.findByRole('heading', { name: 'Leadership offsite' });
    expect(screen.queryByText('Anna')).not.toBeInTheDocument();
  });

  it('shows names when enabled', async () => {
    game = makeGame({ settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: true } });
    openScreen();
    expect(await screen.findByText('Anna')).toBeInTheDocument();
  });

  it('shows progress counters: connections, groups, people not connected yet', async () => {
    openScreen();
    const counters = await screen.findByRole('list', { name: 'Progress' });
    expect(counters).toHaveTextContent('1 connections');
    expect(counters).toHaveTextContent('3 groups');
    expect(counters).toHaveTextContent('2 not connected yet');
  });

  it('celebrates when everyone is in one network', async () => {
    const link = (id: string, a: string, b: string) => ({
      id,
      aId: a,
      aName: a,
      bId: b,
      bName: b,
      topicId: 'dogs',
      topicName: 'Dogs',
      createdBy: a,
      createdAt: '2026-10-17T10:00:00.000Z',
    });
    game = makeGame({ connections: [link('c1', 'anna', 'ivan'), link('c2', 'ivan', 'olena'), link('c3', 'olena', 'maksym')] });
    openScreen();
    expect(await screen.findByText('Everyone is connected! 🎉')).toBeInTheDocument();
  });

  it('shows "Time left" while running', async () => {
    game = makeGame({ timer: { state: 'running', minutes: 30, remainingSec: 600 } });
    openScreen();
    expect(await screen.findByText('Time left')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
  });

  it('notifies when time is up but does not stop the game', async () => {
    game = makeGame({ timer: { state: 'running', minutes: 30, remainingSec: 0 } });
    openScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent("Time's up!");
    expect(screen.getByText('You can keep adding connections.')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    expect(screen.getAllByTestId('dot')).toHaveLength(4); // the graph keeps working
  });

  it('shows paused state', async () => {
    game = makeGame({ timer: { state: 'paused', minutes: 30, remainingSec: 420 } });
    openScreen();
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('7:00');
  });

  it('shows an error when the game cannot be found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) =>
        path === '/api/manage/me'
          ? reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' })
          : reply(404, { error: 'Game not found' }),
      ),
    );
    openScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Game not found');
  });
});

describe('Timer and screen settings (admin page)', () => {
  it('starts the timer', async () => {
    const user = userEvent.setup();
    openGame();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    expect(calls).toContainEqual({ method: 'POST', path: `/api/manage/games/${GAME_ID}/timer`, body: { action: 'start' } });
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByLabelText('Timer length (minutes)')).toBeDisabled();
  });

  it('generates a short link with is.gd into the text box and saves it with the settings', async () => {
    const user = userEvent.setup();
    openGame();
    const box = await screen.findByLabelText('Short link shown on the screen.');
    expect(box).toHaveAttribute('placeholder', 'is.gd');
    await user.click(screen.getByRole('button', { name: 'Generate a short link with is.gd' }));
    await waitFor(() => expect(box).toHaveValue('is.gd/aB3x9Q'));
    expect(calls).toContainEqual({ method: 'POST', path: `/api/manage/games/${GAME_ID}/shortlink`, body: {} });
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ shortUrl: 'is.gd/aB3x9Q' }));
  });

  it('shows a short message and keeps the text box when is.gd is not available', async () => {
    const user = userEvent.setup();
    shortLinkReply = reply(502, { error: 'Sorry, is.gd is not available today.' });
    openGame();
    const box = await screen.findByLabelText('Short link shown on the screen.');
    await user.type(box, 'aka.ms/mine');
    await user.click(screen.getByRole('button', { name: 'Generate a short link with is.gd' }));
    expect(await screen.findByText('Sorry, is.gd is not available today.')).toBeInTheDocument();
    expect(box).toHaveValue('aka.ms/mine');
  });

  it('saves the short link, rules, timer length and names toggle', async () => {
    const user = userEvent.setup();
    openGame();
    await screen.findByRole('button', { name: 'Start timer' });
    await user.type(screen.getByLabelText('Short link shown on the screen.'), 'aka.ms/connect');
    await user.type(screen.getByLabelText('Rules shown on the screen'), 'Be kind.');
    await user.clear(screen.getByLabelText('Timer length (minutes)'));
    await user.type(screen.getByLabelText('Timer length (minutes)'), '45');
    await user.click(screen.getByLabelText('Show names on the Timer screen graph'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      shortUrl: 'aka.ms/connect',
      rulesText: 'Be kind.',
      showNames: true,
      timerMinutes: 45,
    });
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });

  it('links to the Timer screen in a new window', async () => {
    openGame();
    const link = await screen.findByRole('link', { name: 'Open Timer screen' });
    expect(link).toHaveAttribute('href', `/admin/games/${GAME_ID}/screen`);
    expect(link).toHaveAttribute('target', '_blank');
  });
});
