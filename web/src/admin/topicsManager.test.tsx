import type { GameDetails } from '@ctd/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { strings } from '../strings';
import { TopicsManager } from './TopicsManager';

// A topic from before names were limited to 30 characters.
const LONG = 'Have a very long and unusually detailed topic name';

const game: GameDetails = {
  id: 'g1',
  name: 'Offsite',
  code: '123456',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-04T00:00:00.000Z',
  expired: false,
  participants: [],
  topics: [
    { id: 't1', name: LONG },
    { id: 't2', name: '🐕 Have dogs' },
  ],
  connections: [],
  settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
  timer: { state: 'idle', minutes: 30, remainingSec: 0 },
  version: 1,
};

describe('TopicsManager with long topic names', () => {
  it('keeps the full name in a tooltip, so the visible name can be cut with an ellipsis', () => {
    render(<TopicsManager game={game} onChanged={vi.fn()} onError={vi.fn()} />);
    const name = screen.getByText(LONG, { selector: '.topic-title' });
    expect(name).toHaveClass('topic-title');
    expect(name.closest('.topic-name')).toHaveAttribute('title', LONG);
  });

  it('shows the full name of the chosen merge target as a tooltip of the selector', async () => {
    const user = userEvent.setup();
    render(<TopicsManager game={game} onChanged={vi.fn()} onError={vi.fn()} />);
    const select = screen.getByLabelText(`${strings.mergeInto} 🐕 Have dogs`);
    expect(select).not.toHaveAttribute('title');
    await user.selectOptions(select, 't1');
    expect(select).toHaveAttribute('title', LONG);
  });
});

describe('topic messages', () => {
  it('says how many topics were shortened', () => {
    expect(strings.addedTopicsSummary(2, 1, 1)).toBe('Added 2 topics, 1 already existed, 1 shortened to 30 characters.');
    expect(strings.addedTopicsSummary(1, 0)).toBe('Added 1 topic.');
  });
});

// jsdom does no layout, so these guard the rules that cut a long name with "…" instead of squeezing the buttons.
describe('topic row styles', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');

  it('cuts the name with an ellipsis and keeps the buttons their size', () => {
    expect(css).toMatch(/\.topic-title\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.topic-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
    expect(css).toMatch(/\.topic-merge\s*\{[^}]*width:\s*11rem/);
  });
});
