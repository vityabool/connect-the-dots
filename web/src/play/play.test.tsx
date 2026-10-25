import type { MyConnection, Participant, PlayState, Topic } from '@ctd/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { clearSession } from './session';

const people: Participant[] = [
  { id: 'anna', name: 'Anna Koval' },
  { id: 'ivan', name: 'Ivan Petrenko' },
  { id: 'olena', name: 'Olena Shevchenko' },
];

let topics: Topic[];
let connections: MyConnection[];
let calls: { method: string; path: string; body?: unknown; token?: string }[];
let gameEnded: boolean;
let version: number;

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function state(): PlayState {
  return {
    game: { id: 'g1', name: 'Offsite', expiresAt: new Date(Date.now() + 1e9).toISOString(), version },
    me: people[0] as Participant,
    participants: people,
    topics,
    connections,
  };
}

beforeEach(() => {
  clearSession();
  topics = [{ id: 't-dogs', name: 'Have dogs' }];
  connections = [];
  calls = [];
  gameEnded = false;
  version = 1;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const [route, query] = path.split('?');
      const since = query ? Number(new URLSearchParams(query).get('since')) : undefined;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const token = (init?.headers as Record<string, string> | undefined)?.['x-player-token'];
      calls.push({ method, path, body, token });

      if (path === '/api/play/join') {
        if (body.code !== '123456') return reply(404, { error: 'We could not find a game with that code' });
        return reply(200, { token: 'joined-token', game: { id: 'g1', name: 'Offsite' }, participants: people });
      }
      if (path === '/api/play/identity') return reply(200, { token: 'identified-token', me: people[0] });
      if (gameEnded) return reply(410, { error: 'This game has ended' });
      if (route === '/api/play/state') {
        if (since === version) return reply(200, { unchanged: true, version });
        return reply(200, state());
      }
      if (path === '/api/play/connections' && method === 'POST') {
        const other = people.find((p) => p.id === body.otherId) as Participant;
        let topic = topics.find((t) => t.id === body.topicId);
        if (!topic && body.newTopicName) {
          topic = { id: `t-${body.newTopicName}`, name: body.newTopicName };
          topics = [...topics, topic];
        }
        if (connections.some((c) => c.otherId === other.id && c.topicId === topic?.id)) {
          return reply(409, { error: `You and ${other.name} are already connected on "${topic?.name}"` });
        }
        const created: MyConnection = {
          id: `c${connections.length + 1}`,
          otherId: other.id,
          otherName: other.name,
          topicId: topic?.id ?? '',
          topicName: topic?.name ?? '',
          createdByMe: true,
          createdAt: new Date().toISOString(),
        };
        connections = [created, ...connections];
        version += 1;
        return reply(200, created);
      }
      if (path.startsWith('/api/play/connections/') && method === 'DELETE') {
        connections = connections.filter((c) => c.id !== decodeURIComponent(path.split('/').pop() ?? ''));
        version += 1;
        return reply(204);
      }
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

async function joinAndPickName(user: ReturnType<typeof userEvent.setup>) {
  renderAt('/');
  await user.type(screen.getByLabelText('Game code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Join' }));
  await user.selectOptions(await screen.findByLabelText('Your name'), 'anna');
  await user.click(screen.getByRole('button', { name: 'Continue as Anna Koval' }));
  await screen.findByText('Hi Anna Koval!');
}

describe('joining', () => {
  it('shows an error for a wrong code and stays on the page', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByLabelText('Game code'), '999999');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not find a game with that code');
  });

  it('lets the player choose a name and then shows the game', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    expect(screen.getByRole('heading', { name: 'Offsite' })).toBeInTheDocument();
    expect(screen.getByText('No connections yet. Go talk to someone!')).toBeInTheDocument();
    // The identified token is used from now on.
    expect(calls.find((c) => c.path === '/api/play/state')?.token).toBe('identified-token');
  });

  it('does not offer yourself as someone to connect with', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    const options = within(screen.getByLabelText('Connected with')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Choose a person…', 'Ivan Petrenko', 'Olena Shevchenko']);
  });
});

describe('adding connections', () => {
  it('connects with someone on an existing topic', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    await user.selectOptions(screen.getByLabelText('Connected with'), 'ivan');
    await user.selectOptions(screen.getByLabelText('You both…'), 't-dogs');
    await user.click(screen.getByRole('button', { name: 'Add connection' }));

    expect(await screen.findByText('Connected with Ivan Petrenko: Have dogs')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'My connections (1)' })).toBeInTheDocument();
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/api/play/connections', body: { otherId: 'ivan', topicId: 't-dogs' } }),
    );
  });

  it('adds a new topic on the fly', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    await user.selectOptions(screen.getByLabelText('Connected with'), 'olena');
    await user.selectOptions(screen.getByLabelText('You both…'), '__new__');
    await user.type(screen.getByLabelText('New topic'), 'Rock climbing');
    await user.click(screen.getByRole('button', { name: 'Add connection' }));

    expect(await screen.findByText('Connected with Olena Shevchenko: Rock climbing')).toBeInTheDocument();
    expect(calls).toContainEqual(
      expect.objectContaining({ body: { otherId: 'olena', newTopicName: 'Rock climbing' } }),
    );
  });

  it('asks for a new topic straight away when the game has none', async () => {
    topics = [];
    const user = userEvent.setup();
    await joinAndPickName(user);
    expect(screen.queryByLabelText('You both…')).not.toBeInTheDocument();
    expect(screen.getByLabelText('New topic')).toBeInTheDocument();
  });

  it('shows the server message when the pair is already connected on that topic', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await user.selectOptions(screen.getByLabelText('Connected with'), 'ivan');
      await user.selectOptions(screen.getByLabelText('You both…'), 't-dogs');
      await user.click(screen.getByRole('button', { name: 'Add connection' }));
      if (attempt === 0) await screen.findByText('Connected with Ivan Petrenko: Have dogs');
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('already connected on "Have dogs"');
  });

  it('keeps the button disabled until a person and a topic are chosen', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    const button = screen.getByRole('button', { name: 'Add connection' });
    expect(button).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Connected with'), 'ivan');
    expect(button).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('You both…'), 't-dogs');
    expect(button).toBeEnabled();
  });
});

describe('deleting connections', () => {
  beforeEach(() => {
    connections = [
      {
        id: 'c1',
        otherId: 'ivan',
        otherName: 'Ivan Petrenko',
        topicId: 't-dogs',
        topicName: 'Have dogs',
        createdByMe: false,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  it('shows who added the connection', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    const list = screen.getByRole('list');
    expect(within(list).getByText('Ivan Petrenko')).toBeInTheDocument();
    expect(within(list).getByText('added you')).toBeInTheDocument();
  });

  it('asks "Are you sure?" and only deletes after confirming', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);

    await user.click(screen.getByRole('button', { name: 'Delete Ivan Petrenko Have dogs' }));
    expect(screen.getByText('Are you sure you want to delete it?')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Are you sure you want to delete it?')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Delete Ivan Petrenko Have dogs' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('No connections yet. Go talk to someone!')).toBeInTheDocument();
  });
});

describe('game over', () => {
  it('tells the player when the game has ended', async () => {
    gameEnded = true;
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByLabelText('Game code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    await user.selectOptions(await screen.findByLabelText('Your name'), 'anna');
    await user.click(screen.getByRole('button', { name: 'Continue as Anna Koval' }));
    expect(await screen.findByText('This game has ended.')).toBeInTheDocument();
  });
});

describe('live updates', () => {
  it('shows a connection a colleague added, without any reload', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    expect(screen.getByText('No connections yet. Go talk to someone!')).toBeInTheDocument();

    // Ivan adds Anna on another phone.
    connections = [
      {
        id: 'from-ivan',
        otherId: 'ivan',
        otherName: 'Ivan Petrenko',
        topicId: 't-dogs',
        topicName: 'Have dogs',
        createdByMe: false,
        createdAt: new Date().toISOString(),
      },
    ];
    version += 1;

    expect(await screen.findByRole('heading', { name: 'My connections (1)' }, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.getByText('added you')).toBeInTheDocument();
  });

  it('shows a new topic added by someone else in the topic list', async () => {
    const user = userEvent.setup();
    await joinAndPickName(user);
    topics = [...topics, { id: 't-chess', name: 'Play chess' }];
    version += 1;
    await waitFor(() => expect(screen.getByRole('option', { name: 'Play chess' })).toBeInTheDocument(), {
      timeout: 6000,
    });
  });
});
