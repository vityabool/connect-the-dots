import type { AdminConnection, GameDetails } from '@ctd/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ReplayView } from './ReplayView';
import { makeTopicColors } from '../graph/palette';
import { graphData } from '../admin/gameData';

const GAME_ID = 'a'.repeat(32);
const NAMES: Record<string, string> = {
  anna: 'Anna',
  ivan: 'Ivan',
  olena: 'Olena',
  maksym: 'Maksym',
  iryna: 'Iryna',
  taras: 'Taras',
};
const TOPICS: Record<string, string> = { dogs: 'Dogs', tennis: 'Tennis', chess: 'Chess', hiking: 'Hiking', unused: 'Unused' };

const conn = (id: string, a: string, b: string, topicId: string, minute: number): AdminConnection => ({
  id,
  aId: a,
  aName: NAMES[a] ?? '',
  bId: b,
  bName: NAMES[b] ?? '',
  topicId,
  topicName: TOPICS[topicId] ?? '',
  createdBy: a,
  createdAt: `2026-10-17T10:${String(minute).padStart(2, '0')}:00.000Z`,
});

function makeGame(connections: AdminConnection[] | undefined = undefined): GameDetails {
  return {
    id: GAME_ID,
    name: 'Leadership offsite',
    code: '123456',
    createdAt: '2026-10-17T09:00:00.000Z',
    expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    expired: false,
    participants: Object.entries(NAMES).map(([id, name]) => ({ id, name })),
    topics: Object.entries(TOPICS).map(([id, name]) => ({ id, name })),
    connections: connections ?? [
      conn('c1', 'anna', 'ivan', 'dogs', 1),
      conn('c2', 'anna', 'olena', 'dogs', 2),
      conn('c3', 'ivan', 'olena', 'tennis', 3),
      conn('c4', 'anna', 'maksym', 'chess', 4),
      conn('c5', 'olena', 'maksym', 'dogs', 5),
      conn('c6', 'anna', 'ivan', 'hiking', 6),
    ],
    settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
    timer: { state: 'idle', minutes: 30, remainingSec: 1800 },
    version: 1,
  };
}

let game: GameDetails;

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  game = makeGame();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      const [route] = path.split('?');
      if (route === '/api/manage/me') return reply(200, { displayName: 'boss@example.com', identityProvider: 'aad' });
      if (route === `/api/manage/games/${GAME_ID}`) return reply(200, game);
      return reply(404, { error: 'Not found' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock('html-to-image');
});

function open(view?: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/games/${GAME_ID}/results${view ? `?view=${view}` : ''}`]}>
      <App />
    </MemoryRouter>,
  );
}

describe('results page', () => {
  it('offers all nine views and starts with the network', async () => {
    open();
    const nav = await screen.findByRole('navigation', { name: 'Results views' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Network',
      'Top topics',
      'Super-connectors',
      'Unexpected links',
      'Groups',
      'Topic spotlight',
      'Who met whom',
      'Replay',
      'Summary',
    ]);
    expect(within(nav).getByRole('button', { name: 'Network' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findAllByTestId('dot')).toHaveLength(6);
  });

  it('switches views with the tabs', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Summary' }));
    expect(await screen.findByText('Top connector')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-current', 'page');
  });

  it('exports the current view as a PNG named after the game and view', async () => {
    const toPng = vi.fn(async () => 'data:image/png;base64,AAAA');
    vi.doMock('html-to-image', () => ({ toPng }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    open('summary');
    await user.click(await screen.findByRole('button', { name: 'Export image' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(toPng).toHaveBeenCalledTimes(1);
  });

  it('shows an error when no game is found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) =>
        path === '/api/manage/me' ? reply(200, { displayName: 'b', identityProvider: 'aad' }) : reply(404, { error: 'Game not found' }),
      ),
    );
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Game not found');
  });
});

describe('network view', () => {
  it('shows names, a legend of the topics in use, and the counters', async () => {
    open('network');
    expect(await screen.findAllByText('Anna')).not.toHaveLength(0);
    const legend = screen.getByRole('list', { name: 'Topic colors' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Dogs', 'Tennis', 'Chess', 'Hiking']);
    const counters = screen.getByRole('list', { name: 'Progress' });
    expect(counters).toHaveTextContent('6 connections');
    expect(counters).toHaveTextContent('3 groups');
    expect(counters).toHaveTextContent('2 not connected yet');
  });
});

describe('top topics view', () => {
  it('ranks topics by use and highlights one on click', async () => {
    const user = userEvent.setup();
    open('topics');
    const list = await screen.findByRole('list', { name: 'Top topics' });
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Dogs');
    expect(rows[0]).toHaveTextContent('3');
    expect(rows).toHaveLength(4); // the unused topic is not listed

    await user.click(rows[0] as HTMLElement);
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelectorAll('.edge.faded')).toHaveLength(3); // the 3 non-dog lines fade
    await user.click(rows[0] as HTMLElement);
    expect(document.querySelectorAll('.edge.faded')).toHaveLength(0);
  });
});

describe('super-connectors view', () => {
  it('names the connector of the day and ranks people', async () => {
    open('connectors');
    expect(await screen.findByText(/Connector of the day/)).toHaveTextContent('Anna');
    expect(screen.getByText(/4 connections with 3 different people/)).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual(['🥇', '🥈', '🥉', '4']);
    expect(within(rows[0] as HTMLElement).getByRole('rowheader')).toHaveTextContent('Anna');
  });
});

describe('unexpected links view', () => {
  it('lists connections on rare topics', async () => {
    open('unexpected');
    expect(await screen.findByText('Ivan ↔ Olena')).toBeInTheDocument();
    expect(screen.getByText('Tennis')).toBeInTheDocument();
    expect(screen.getAllByText('used once')).toHaveLength(3);
    expect(screen.queryByText('Olena ↔ Maksym')).not.toBeInTheDocument(); // Dogs is used 3 times
  });

  it('explains when there are none', async () => {
    game = makeGame([conn('c1', 'anna', 'ivan', 'dogs', 1), conn('c2', 'anna', 'olena', 'dogs', 2), conn('c3', 'ivan', 'olena', 'dogs', 3)]);
    open('unexpected');
    expect(await screen.findByText(/No unexpected links yet/)).toBeInTheDocument();
  });
});

describe('groups view', () => {
  it('shows separate groups and who is still alone', async () => {
    open('groups');
    expect(await screen.findByText('3 separate groups, 2 people still alone')).toBeInTheDocument();
    expect(screen.getByText('Group 1 (4 people)')).toBeInTheDocument();
    expect(screen.getByText('Still alone (2)')).toBeInTheDocument();
    expect(screen.getByText('Iryna, Taras')).toBeInTheDocument();
  });

  it('celebrates when everyone is connected', async () => {
    game = makeGame([
      ...makeGame().connections,
      conn('c7', 'maksym', 'iryna', 'chess', 7),
      conn('c8', 'iryna', 'taras', 'hiking', 8),
    ]);
    open('groups');
    expect(await screen.findByText('Everyone is connected! 🎉')).toBeInTheDocument();
    expect(screen.queryByText(/still alone/)).not.toBeInTheDocument();
  });
});

describe('topic spotlight view', () => {
  it('lists the people sharing a topic and switches topic', async () => {
    const user = userEvent.setup();
    open('spotlight');
    expect(await screen.findByRole('heading', { name: 'Dogs: 4 people' })).toBeInTheDocument();
    expect(document.querySelectorAll('.name-list li')).toHaveLength(4);

    await user.selectOptions(screen.getByLabelText('Choose a topic'), 'chess');
    expect(await screen.findByRole('heading', { name: 'Chess: 2 people' })).toBeInTheDocument();
    expect(document.querySelectorAll('.edge.faded')).toHaveLength(5);
  });
});

describe('connection matrix view', () => {
  it('fills a square for each connected pair, in both directions', async () => {
    open('matrix');
    await screen.findByRole('img', { name: 'Who met whom' });
    expect(screen.getAllByTestId('matrix-filled')).toHaveLength(10); // 5 pairs x 2
  });
});

describe('replay view', () => {
  function replayProps(stepMs: number) {
    const data = graphData(game);
    return {
      game,
      people: data.people,
      nodes: data.nodes,
      edges: data.edges,
      statEdges: data.statEdges,
      topicColor: makeTopicColors(game.topics),
      animate: false,
      stepMs,
    };
  }

  it('starts showing everything and plays the connections one by one', async () => {
    const user = userEvent.setup();
    render(<ReplayView {...replayProps(15)} />);
    expect(screen.getAllByTestId('edge')).toHaveLength(6);
    expect(screen.getByText('6 / 6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Play again/ }));
    expect(screen.getByText(/Before the first connection|Anna ↔ Ivan: Dogs/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('6 / 6')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('Anna ↔ Ivan: Hiking')).toBeInTheDocument();
  });

  it('shows the network as it was at any point with the slider, keeping everyone in place', async () => {
    render(<ReplayView {...replayProps(15)} />);
    const slider = screen.getByLabelText('Replay position');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(slider, { target: { value: '2' } });
    expect(screen.getAllByTestId('edge')).toHaveLength(2);
    expect(screen.getAllByTestId('dot')).toHaveLength(6); // people stay where they are
    expect(screen.getByText('Anna ↔ Olena: Dogs')).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.queryAllByTestId('edge')).toHaveLength(0);
    expect(screen.getByText('Before the first connection')).toBeInTheDocument();
  });
});

describe('summary view', () => {
  it('shows the headline numbers', async () => {
    open('summary');
    await screen.findByText('Top connector');
    const grid = within(document.querySelector('.summary-grid') as HTMLElement);
    const value = (label: string) => (grid.getByText(label).closest('div') as HTMLElement).textContent;
    expect(value('People')).toBe('People6');
    expect(value('Connections')).toBe('Connections6');
    expect(value('Topics used')).toBe('Topics used4');
    expect(value('Groups')).toBe('Groups3');
    expect(value('Not connected')).toBe('Not connected2');
    expect(screen.getByText('Dogs (3)')).toBeInTheDocument();
    expect(screen.getByText('Anna (4)')).toBeInTheDocument();
  });
});

describe('empty game', () => {
  it('shows a friendly message in every data view', async () => {
    game = makeGame([]);
    for (const view of ['topics', 'connectors', 'matrix', 'spotlight', 'replay']) {
      const { unmount } = open(view);
      if (view === 'matrix') {
        expect(await screen.findByRole('img', { name: 'Who met whom' })).toBeInTheDocument();
      } else {
        expect(await screen.findByText('No connections yet.')).toBeInTheDocument();
      }
      unmount();
    }
  });
});
