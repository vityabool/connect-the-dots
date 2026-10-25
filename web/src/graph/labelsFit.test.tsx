import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatrixView } from '../results/MatrixView';
import type { ViewProps } from '../results/types';
import { computeLayout, GRAPH_SIZE } from './layout';
import { NetworkGraph, type GraphEdge, type GraphNode } from './NetworkGraph';
import { makeTopicColors } from './palette';

// Names must never be cut off at the edge of an exported picture (GitHub issue #2, second defect):
// the matrix needs margins that fit its longest names, and the graph keeps people (and their names)
// away from the edges.

/** The same rough text width the matrix uses to reserve space (average character is about 0.6 em). */
const textWidth = (name: string, fontSize: number) => name.length * fontSize * 0.6;

const NAMES = [
  'Adina Samoila',
  'Prabodh Reddy Kommidi',
  'Luis Orozco Martinez',
  'Aniruddha Khandge',
  'Viswanath Ramanan',
  'Zed',
];

function matrixProps(names: string[]): ViewProps {
  const people = names.map((name, i) => ({ id: `p${i}`, name }));
  const nodes: GraphNode[] = people.map((p) => ({ id: p.id, label: p.name }));
  const edges: GraphEdge[] = [{ id: 'e1', a: 'p0', b: 'p1', topicId: 't1' }];
  return {
    game: {
      id: 'g',
      name: 'Game',
      code: '123456',
      createdAt: '2026-10-17T09:00:00.000Z',
      expiresAt: '2026-10-20T09:00:00.000Z',
      expired: false,
      participants: people,
      topics: [{ id: 't1', name: 'Dogs' }],
      connections: [],
      settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
      timer: { state: 'idle', minutes: 30, remainingSec: 1800 },
      version: 1,
    },
    people,
    nodes,
    edges,
    statEdges: [{ id: 'e1', a: 'p0', b: 'p1', topicId: 't1', createdAt: '2026-10-17T10:00:00.000Z' }],
    topicColor: makeTopicColors([{ id: 't1', name: 'Dogs' }]),
    animate: false,
  };
}

describe('matrix keeps long names inside the picture', () => {
  it('leaves room on the left for the longest row name', () => {
    const { container } = render(<MatrixView {...matrixProps(NAMES)} />);
    const rowLabels = [...container.querySelectorAll('text.matrix-label')].filter((t) => t.getAttribute('text-anchor') === 'end');
    expect(rowLabels).toHaveLength(NAMES.length);
    const fontSize = Number(rowLabels[0]?.getAttribute('font-size'));
    const longest = Math.max(...NAMES.map((n) => textWidth(n, fontSize)));
    for (const label of rowLabels) expect(Number(label.getAttribute('x'))).toBeGreaterThanOrEqual(longest);
  });

  it('leaves room above the grid for the slanted column names', () => {
    const { container } = render(<MatrixView {...matrixProps(NAMES)} />);
    const columnLabels = [...container.querySelectorAll('text.matrix-label')].filter((t) => t.getAttribute('transform')?.includes('rotate'));
    expect(columnLabels).toHaveLength(NAMES.length);
    const fontSize = Number(columnLabels[0]?.getAttribute('font-size'));
    const longest = Math.max(...NAMES.map((n) => textWidth(n, fontSize)));
    for (const label of columnLabels) {
      const match = label.getAttribute('transform')?.match(/translate\(([\d.]+) ([\d.]+)\)/);
      // a name rotated by 60 degrees rises by about 0.87 times its width
      expect(Number(match?.[2])).toBeGreaterThanOrEqual(longest * 0.866);
    }
  });

  it('leaves room on the right for the last column name', () => {
    const { container } = render(<MatrixView {...matrixProps(NAMES)} />);
    const svg = container.querySelector('svg') as SVGElement;
    const viewWidth = Number((svg.getAttribute('viewBox') ?? '').split(' ')[2]);
    const columnLabels = [...container.querySelectorAll('text.matrix-label')].filter((t) => t.getAttribute('transform')?.includes('rotate'));
    for (const label of columnLabels) {
      const start = Number(label.getAttribute('transform')?.match(/translate\(([\d.]+) /)?.[1]);
      const width = textWidth(label.textContent ?? '', Number(label.getAttribute('font-size')));
      expect(start + width * 0.5).toBeLessThanOrEqual(viewWidth);
    }
  });

  it('keeps the viewBox square-ish and finite for short names too', () => {
    const { container } = render(<MatrixView {...matrixProps(['Al', 'Bo', 'Cy'])} />);
    const [x, y, w, h] = (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect([x, y]).toEqual([0, 0]);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });
});

describe('network graph keeps people and their names away from the edges', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `n${i}`);
  const edges = ids.slice(1).map((id, i) => ({ a: ids[i] ?? '', b: id }));

  it('computeLayout honours a custom padding', () => {
    const layout = computeLayout(ids, edges, undefined, GRAPH_SIZE, { x: 130, y: 80 });
    for (const { x, y } of layout.values()) {
      expect(x).toBeGreaterThanOrEqual(130 - 0.001);
      expect(x).toBeLessThanOrEqual(GRAPH_SIZE.width - 130 + 0.001);
      expect(y).toBeGreaterThanOrEqual(80 - 0.001);
      expect(y).toBeLessThanOrEqual(GRAPH_SIZE.height - 80 + 0.001);
    }
  });

  function positions(showNames: boolean) {
    const nodes: GraphNode[] = ids.map((id) => ({ id, label: 'Prabodh Reddy Kommidi' }));
    const graphEdges: GraphEdge[] = edges.map((e, i) => ({ id: `e${i}`, a: e.a, b: e.b, topicId: 't' }));
    const { container } = render(
      <NetworkGraph nodes={nodes} edges={graphEdges} showNames={showNames} topicColor={() => '#38bdf8'} animate={false} />,
    );
    return [...container.querySelectorAll('[data-testid=dot]')].map((dot) => {
      const match = dot.getAttribute('transform')?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    });
  }

  it('leaves room for long names left and right of every dot when names are shown', () => {
    for (const { x, y } of positions(true)) {
      expect(x).toBeGreaterThanOrEqual(110);
      expect(x).toBeLessThanOrEqual(GRAPH_SIZE.width - 110);
      expect(y).toBeLessThanOrEqual(GRAPH_SIZE.height - 60);
    }
  });

  it('may use more of the width when no names need room', () => {
    const spread = (points: { x: number }[]) => Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    expect(spread(positions(false))).toBeGreaterThanOrEqual(spread(positions(true)) - 0.001);
  });
});
