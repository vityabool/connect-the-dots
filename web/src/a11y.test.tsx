import type { GameDetails, MyConnection, PlayState } from '@ctd/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { clearSession, saveSession } from './play/session';

// Automated accessibility checks (axe) on every main screen. They catch missing labels, wrong roles,
// duplicate ids and similar problems. Color contrast cannot be measured in a simulated browser and
// was reviewed by hand instead (see docs/ACCESSIBILITY.md).

const GAME_ID = 'a'.repeat(32);
const people = [
  { id: 'anna', name: 'Anna Koval' },
  { id: 'ivan', name: 'Ivan Petrenko' },
  { id: 'olena', name: 'Olena Shevchenko' },
];

const game: GameDetails = {
  id: GAME_ID,
  name: 'Leadership offsite',
  code: '123456',
  createdAt: '2026-10-17T09:00:00.000Z',
  expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  expired: false,
  participants: people,
  topics: [
    { id: 'dogs', name: 'Dogs' },
    { id: 'tennis', name: 'Tennis' },
  ],
  connections: [
    { id: 'c1', aId: 'anna', aName: 'Anna Koval', bId: 'ivan', bName: 'Ivan Petrenko', topicId: 'dogs', topicName: 'Dogs', createdBy: 'anna', createdAt: '2026-10-17T10:00:00.000Z' },
    { id: 'c2', aId: 'ivan', aName: 'Ivan Petrenko', bId: 'olena', bName: 'Olena Shevchenko', topicId: 'tennis', topicName: 'Tennis', createdBy: 'ivan', createdAt: '2026-10-17T10:05:00.000Z' },
  ],
  settings: { shortUrl: 'aka.ms/connect', rulesText: '', timerMinutes: 30, showNames: true },
  timer: { state: 'running', minutes: 30, remainingSec: 900 },
  version: 1,
};

const myConnection: MyConnection = {
  id: 'c1',
  otherId: 'ivan',
  otherName: 'Ivan Petrenko',
  topicId: 'dogs',
  topicName: 'Dogs',
  createdByMe: true,
  createdAt: '2026-10-17T10:00:00.000Z',
};

const playState: PlayState = {
  game: { id: GAME_ID, name: 'Leadership offsite', expiresAt: game.expiresAt, version: 1 },
  me: people[0] ?? { id: '', name: '' },
  participants: people,
  topics: game.topics,
  connections: [myConnection],
};

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  clearSession();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      const [route] = path.split('?');
      if (route === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
      if (route === '/api/manage/games') return reply(200, [{ id: GAME_ID, name: game.name, code: game.code, createdAt: game.createdAt, expiresAt: game.expiresAt, expired: false }]);
      if (route === `/api/manage/games/${GAME_ID}`) return reply(200, game);
      if (route === '/api/play/state') return reply(200, playState);
      return reply(404, { error: 'Not found' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('accessibility (axe)', () => {
  it.each(['/', '/how-to-play', '/privacy', '/terms', '/this-page-does-not-exist'])('public page %s', async (path) => {
    const { container } = renderAt(path);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('join page opened from a link or QR code', async () => {
    const { container } = renderAt('/join/123456');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('choose your name', async () => {
    saveSession({ token: 'joined', gameName: game.name, participants: people });
    const { container } = renderAt('/play');
    await screen.findByLabelText('Your name');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('player screen with a connection and the delete confirmation', async () => {
    saveSession({ token: 'identified', gameName: game.name, participants: people, me: people[0] });
    const user = userEvent.setup();
    const { container } = renderAt('/play');
    await screen.findByText('Hi Anna Koval!');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(await screen.findByRole('button', { name: /Delete Ivan Petrenko Dogs/ }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('admin sign-in prompt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { error: 'no' })));
    const { container } = renderAt('/admin');
    await screen.findByRole('link', { name: 'Sign in with Microsoft' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('admin games list', async () => {
    const { container } = renderAt('/admin');
    await screen.findByText('Leadership offsite');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('admin game page', async () => {
    const { container } = renderAt(`/admin/games/${GAME_ID}`);
    await screen.findByRole('heading', { name: 'Leadership offsite' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('big-screen Timer screen', async () => {
    const { container } = renderAt(`/admin/games/${GAME_ID}/screen`);
    await screen.findByRole('timer');
    await screen.findByRole('img', { name: 'QR code that opens the join page' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(['network', 'topics', 'connectors', 'unexpected', 'groups', 'spotlight', 'matrix', 'replay', 'summary'])(
    'results view: %s',
    async (view) => {
      const { container } = renderAt(`/admin/games/${GAME_ID}/results?view=${view}`);
      await screen.findByRole('navigation', { name: 'Results views' });
      await screen.findByRole('region', { name: /./ });
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('crash screen', async () => {
    const Bomb = () => {
      throw new Error('boom');
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(await screen.findByText('Oops, something broke')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
