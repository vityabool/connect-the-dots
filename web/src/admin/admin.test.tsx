import type { GameDetails, GameSummary } from '@ctd/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();

const summary: GameSummary = {
  id: 'a'.repeat(32),
  name: 'Offsite',
  code: '123456',
  createdAt: iso(-1),
  expiresAt: iso(2),
  expired: false,
};

let games: GameSummary[];
let details: GameDetails;
let calls: { method: string; path: string; body?: unknown }[];

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  games = [summary];
  details = { ...summary, participants: [{ id: 'p1', name: 'Anna Koval' }], topics: [], connections: [], settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
    timer: { state: 'idle', minutes: 30, remainingSec: 1800 }, version: 1 };
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });

      if (path === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
      if (path === '/api/manage/games' && method === 'GET') return reply(200, games);
      if (path === '/api/manage/games' && method === 'POST') {
        return reply(200, { ...summary, id: 'b'.repeat(32), name: body.name });
      }
      if (path === `/api/manage/games/${summary.id}` && method === 'GET') return reply(200, details);
      if (path === `/api/manage/games/${summary.id}` && method === 'DELETE') return reply(204);
      if (path === `/api/manage/games/${summary.id}/participants` && method === 'POST') {
        details = { ...details, participants: [...details.participants, { id: 'p2', name: 'Ivan Petrenko' }] };
        return reply(200, { added: [{ id: 'p2', name: 'Ivan Petrenko' }], duplicatesSkipped: 1, tooLongSkipped: 0 });
      }
      if (path === `/api/manage/games/${summary.id}/topics` && method === 'POST') {
        details = { ...details, topics: [{ id: 't1', name: 'Have dogs' }] };
        return reply(200, { added: [{ id: 't1', name: 'Have dogs' }], duplicatesSkipped: 0, shortened: 0 });
      }
      if (path.startsWith(`/api/manage/games/${summary.id}/participants/`) && method === 'DELETE') {
        details = { ...details, participants: [] };
        return reply(204);
      }
      return reply(404, { error: 'Not found' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('My games', () => {
  it('lists the admin games with their codes', async () => {
    renderAt('/admin');
    expect(await screen.findByText('Offsite')).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByText(/boss@example.com/)).toBeInTheDocument();
  });

  it('creates a game and opens it', async () => {
    const user = userEvent.setup();
    renderAt('/admin');
    await screen.findByText('Offsite');
    await user.type(screen.getByLabelText('Game name'), 'Team day');
    await user.click(screen.getByRole('button', { name: 'Create game' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: '/api/manage/games', body: { name: 'Team day' } }),
    );
  });

  it('shows an expired badge', async () => {
    games = [{ ...summary, expired: true, expiresAt: iso(-1) }];
    renderAt('/admin');
    expect(await screen.findByText('Expired')).toBeInTheDocument();
  });
});

describe('Game page', () => {
  const path = `/admin/games/${summary.id}`;

  it('shows the code and participants', async () => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: 'Offsite' })).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByText('Anna Koval')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Participants (1)' })).toBeInTheDocument();
  });

  it('adds pasted names and reports skipped duplicates', async () => {
    const user = userEvent.setup();
    renderAt(path);
    await screen.findByText('Anna Koval');
    await user.type(screen.getByLabelText('Add names (one per line)'), 'Ivan Petrenko');
    await user.click(screen.getByRole('button', { name: 'Add names' }));
    expect(await screen.findByText('Added 1, 1 duplicate skipped.')).toBeInTheDocument();
    expect(await screen.findByText('Ivan Petrenko')).toBeInTheDocument();
  });

  it('uploads a .txt file', async () => {
    const user = userEvent.setup();
    renderAt(path);
    await screen.findByText('Anna Koval');
    const file = new File(['Ivan Petrenko\nAnna Koval'], 'people.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('Upload .txt file'), file);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: `/api/manage/games/${summary.id}/participants`,
        body: { text: 'Ivan Petrenko\nAnna Koval' },
      }),
    );
  });

  it('restores the default topics with one click', async () => {
    const user = userEvent.setup();
    renderAt(path);
    await screen.findByText('Anna Koval');
    expect(screen.getByRole('heading', { name: 'Topics (0)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore the default topics' }));

    const post = await waitFor(() => {
      const found = calls.find((c) => c.path.endsWith('/topics'));
      expect(found).toBeDefined();
      return found;
    });
    expect((post?.body as { text: string }).text).toContain('🎾 Play tennis');
    expect(await screen.findByRole('heading', { name: 'Topics (1)' })).toBeInTheDocument();
    expect(await screen.findByText('Added 1 topic.')).toBeInTheDocument();
  });

  it('removes a participant only after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    renderAt(path);
    await screen.findByText('Anna Koval');

    confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Remove Anna Koval' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Remove Anna Koval' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  it('extends the expiry by about 3 days', async () => {
    const user = userEvent.setup();
    renderAt(path);
    await screen.findByText('Anna Koval');
    await user.click(screen.getByRole('button', { name: 'Extend by 3 days' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH');
    const expiresAt = Date.parse((patch?.body as { expiresAt: string }).expiresAt);
    expect(expiresAt).toBeGreaterThan(Date.parse(summary.expiresAt) + 2.9 * 86_400_000);
  });

  it('deletes the game after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt(path);
    await screen.findByText('Anna Koval');
    await user.click(screen.getByRole('button', { name: 'Delete game' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'DELETE', path: `/api/manage/games/${summary.id}`, body: undefined }),
    );
  });

  it('shows an error when the game does not exist', async () => {
    renderAt(`/admin/games/${'c'.repeat(32)}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });
});
