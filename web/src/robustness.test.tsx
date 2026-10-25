import type { GameDetails, PlayState } from '@ctd/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { clearSession, saveSession } from './play/session';

const GAME_ID = 'a'.repeat(32);

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const game: GameDetails = {
  id: GAME_ID,
  name: 'Offsite',
  code: '123456',
  createdAt: '2026-10-17T09:00:00.000Z',
  expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  expired: false,
  participants: [{ id: 'anna', name: 'Anna' }],
  topics: [],
  connections: [],
  settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
  timer: { state: 'idle', minutes: 30, remainingSec: 1800 },
  version: 1,
};

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('expired Microsoft sign-in', () => {
  it('tells the facilitator to sign in again instead of failing silently', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        calls += 1;
        // The platform answers API calls of an expired session with a redirect to the login page.
        expect(init?.redirect).toBe('manual');
        if (path === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
        return { ok: false, status: 0, type: 'opaqueredirect', json: async () => ({}) };
      }),
    );
    render(
      <MemoryRouter initialEntries={[`/admin/games/${GAME_ID}`]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Your sign-in has expired. Reload the page to sign in again.');
    expect(calls).toBeGreaterThan(1);
  });
});

describe('participant file upload', () => {
  function openGame(calls: { path: string; method: string }[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        calls.push({ path, method: init?.method ?? 'GET' });
        if (path === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
        if (path.startsWith(`/api/manage/games/${GAME_ID}`) && (init?.method ?? 'GET') === 'GET') return reply(200, game);
        return reply(200, { added: [], duplicatesSkipped: 0, tooLongSkipped: 0 });
      }),
    );
    return render(
      <MemoryRouter initialEntries={[`/admin/games/${GAME_ID}`]}>
        <App />
      </MemoryRouter>,
    );
  }

  it('refuses a file that is not saved as UTF-8 and explains how to fix it', async () => {
    const calls: { path: string; method: string }[] = [];
    const user = userEvent.setup();
    openGame(calls);
    const input = await screen.findByLabelText('Upload .txt file');
    // A Windows-1251 file read as UTF-8 contains replacement characters.
    const garbled = new File([new Uint8Array([0xc0, 0xed, 0xed, 0xe0, 0x0a, 0xc2, 0xe0, 0xed, 0xff])], 'names.txt', {
      type: 'text/plain',
    });
    await user.upload(input, garbled);
    expect(await screen.findByRole('alert')).toHaveTextContent('not saved as UTF-8');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('accepts a normal UTF-8 file with Cyrillic names', async () => {
    const calls: { path: string; method: string }[] = [];
    const user = userEvent.setup();
    openGame(calls);
    const input = await screen.findByLabelText('Upload .txt file');
    await user.upload(input, new File(['Гліб Фіногенов\nІрина Мельник'], 'names.txt', { type: 'text/plain' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/participants'))).toBe(true));
    expect(screen.queryByText(/not saved as UTF-8/)).not.toBeInTheDocument();
  });
});

describe('typing a new topic while others add topics', () => {
  it('keeps the new-topic box and the typed text when the topic list appears', async () => {
    const people = [
      { id: 'anna', name: 'Anna Koval' },
      { id: 'ivan', name: 'Ivan Petrenko' },
    ];
    let topics: { id: string; name: string }[] = [];
    let version = 1;
    const state = (): PlayState => ({
      game: { id: GAME_ID, name: 'Offsite', expiresAt: new Date(Date.now() + 1e9).toISOString(), version },
      me: people[0] ?? { id: '', name: '' },
      participants: people,
      topics,
      connections: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        const [route, query] = path.split('?');
        if (route === '/api/play/state') {
          const since = query ? Number(new URLSearchParams(query).get('since')) : undefined;
          return since === version ? reply(200, { unchanged: true, version }) : reply(200, state());
        }
        return reply(404, { error: 'Not found' });
      }),
    );
    saveSession({ token: 't', gameName: 'Offsite', participants: people, me: people[0] });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/play']}>
        <App />
      </MemoryRouter>,
    );

    const box = await screen.findByLabelText('New topic');
    await user.type(box, 'Rock climbing');

    // Another player adds topics, so the topic dropdown appears.
    topics = [{ id: 't1', name: 'Have dogs' }];
    version += 1;
    await screen.findByLabelText('You both…', undefined, { timeout: 6000 });

    expect(screen.getByLabelText('New topic')).toHaveValue('Rock climbing');
  });
});
