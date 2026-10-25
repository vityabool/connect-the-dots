import type { AdminConnection, GameDetails } from '@ctd/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const GAME_ID = 'a'.repeat(32);

const conn = (id: string, a: string, b: string, topicId: string, topicName: string): AdminConnection => ({
  id,
  aId: a.toLowerCase(),
  aName: a,
  bId: b.toLowerCase(),
  bName: b,
  topicId,
  topicName,
  createdBy: a.toLowerCase(),
  createdAt: '2026-10-17T10:00:00.000Z',
});

let details: GameDetails;
let calls: { method: string; path: string; body?: unknown }[];

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  details = {
    id: GAME_ID,
    name: 'Offsite',
    code: '123456',
    createdAt: '2026-10-17T09:00:00.000Z',
    expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    expired: false,
    participants: [
      { id: 'anna', name: 'Anna' },
      { id: 'ivan', name: 'Ivan' },
    ],
    topics: [
      { id: 't-dogs', name: 'Dogs' },
      { id: 't-have-dogs', name: 'Have dogs' },
      { id: 't-tennis', name: 'Tennis' },
    ],
    connections: [
      conn('c1', 'Anna', 'Ivan', 't-dogs', 'Dogs'),
      conn('c2', 'Ivan', 'Anna', 't-tennis', 'Tennis'),
    ],
    settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
    timer: { state: 'idle', minutes: 30, remainingSec: 1800 },
    version: 1,
  };
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const [route] = path.split('?');
      calls.push({ method, path: route ?? path, body });
      const base = `/api/manage/games/${GAME_ID}`;

      if (route === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
      if (route === base && method === 'GET') return reply(200, details);
      if (route === `${base}/topics/t-dogs` && method === 'DELETE') {
        details = {
          ...details,
          topics: details.topics.filter((t) => t.id !== 't-dogs'),
          connections: details.connections.filter((c) => c.topicId !== 't-dogs'),
          version: details.version + 1,
        };
        return reply(200, { deletedConnections: 1 });
      }
      if (route === `${base}/topics/t-dogs/merge` && method === 'POST') {
        details = {
          ...details,
          topics: details.topics.filter((t) => t.id !== 't-dogs'),
          connections: details.connections.map((c) =>
            c.topicId === 't-dogs' ? { ...c, topicId: 't-have-dogs', topicName: 'Have dogs' } : c,
          ),
          version: details.version + 1,
        };
        return reply(200, { moved: 1, duplicatesDropped: 0 });
      }
      if (route === `${base}/connections/c2` && method === 'DELETE') {
        details = { ...details, connections: details.connections.filter((c) => c.id !== 'c2'), version: details.version + 1 };
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

function open() {
  return render(
    <MemoryRouter initialEntries={[`/admin/games/${GAME_ID}`]}>
      <App />
    </MemoryRouter>,
  );
}

describe('topics', () => {
  it('shows how many connections each topic has', async () => {
    open();
    const dogs = (await screen.findByText('Dogs', { selector: '.topic-title' })).closest('li') as HTMLElement;
    expect(within(dogs).getByText('(1 connection)')).toBeInTheDocument();
    const haveDogs = screen.getByText('Have dogs', { selector: '.topic-title' }).closest('li') as HTMLElement;
    expect(within(haveDogs).getByText('(0 connections)')).toBeInTheDocument();
  });

  it('deletes a topic only after confirming, and says how many connections go with it', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    open();
    await screen.findByText('Dogs', { selector: '.topic-title' });

    confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Delete topic Dogs' }));
    expect(confirm).toHaveBeenLastCalledWith('Delete the topic "Dogs"? This also deletes 1 connection made with it.');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Delete topic Dogs' }));
    expect(await screen.findByText('Deleted "Dogs" and 1 connection.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete topic Dogs' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Connections (1)' })).toBeInTheDocument();
  });

  it('merges one topic into another after confirming', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    open();
    await screen.findByText('Dogs', { selector: '.topic-title' });

    expect(screen.getByRole('button', { name: 'Merge Dogs' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Merge into Dogs'), 't-have-dogs');
    await user.click(screen.getByRole('button', { name: 'Merge Dogs' }));

    expect(confirm).toHaveBeenCalledWith(
      'Merge "Dogs" into "Have dogs"? 1 connection will move to "Have dogs" and "Dogs" will be removed.',
    );
    expect(calls).toContainEqual({
      method: 'POST',
      path: `/api/manage/games/${GAME_ID}/topics/t-dogs/merge`,
      body: { targetId: 't-have-dogs' },
    });
    expect(await screen.findByText('Merged "Dogs" into "Have dogs": 1 moved.')).toBeInTheDocument();
    const haveDogs = (await screen.findByText('Have dogs', { selector: '.topic-title' })).closest('li') as HTMLElement;
    expect(within(haveDogs).getByText('(1 connection)')).toBeInTheDocument();
  });
});

describe('connections', () => {
  it('lists connections and filters them', async () => {
    const user = userEvent.setup();
    open();
    expect(await screen.findByRole('heading', { name: 'Connections (2)' })).toBeInTheDocument();
    expect(screen.getByText(/Anna ↔ Ivan: Dogs/)).toBeInTheDocument();
    expect(screen.getByText(/Ivan ↔ Anna: Tennis/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search connections'), 'tennis');
    expect(screen.queryByText(/Anna ↔ Ivan: Dogs/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ivan ↔ Anna: Tennis/)).toBeInTheDocument();
  });

  it('lets the admin delete a connection after confirming', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    open();
    await screen.findByRole('heading', { name: 'Connections (2)' });
    await user.click(screen.getByRole('button', { name: 'Delete Ivan ↔ Anna: Tennis' }));
    expect(await screen.findByRole('heading', { name: 'Connections (1)' })).toBeInTheDocument();
    expect(screen.getByText('Connection deleted.')).toBeInTheDocument();
  });
});
