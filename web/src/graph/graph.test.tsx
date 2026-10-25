import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeLayout, GRAPH_SIZE } from './layout';
import { NetworkGraph, type GraphEdge, type GraphNode } from './NetworkGraph';
import { makeTopicColors, TOPIC_COLORS } from './palette';

const ids = ['a', 'b', 'c', 'd', 'e'];
const nodes: GraphNode[] = ids.map((id) => ({ id, label: `Person ${id.toUpperCase()}` }));
const edges: GraphEdge[] = [
  { id: 'e1', a: 'a', b: 'b', topicId: 't1' },
  { id: 'e2', a: 'b', b: 'c', topicId: 't1' },
  { id: 'e3', a: 'a', b: 'b', topicId: 't2' },
];

describe('computeLayout', () => {
  it('gives every person a finite position inside the picture', () => {
    const layout = computeLayout(ids, edges);
    expect(layout.size).toBe(ids.length);
    for (const { x, y } of layout.values()) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(GRAPH_SIZE.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(GRAPH_SIZE.height);
    }
  });

  it('is deterministic: the same input draws the same picture', () => {
    expect([...computeLayout(ids, edges)]).toEqual([...computeLayout(ids, edges)]);
  });

  it('uses the available area for a larger network', () => {
    const many = Array.from({ length: 30 }, (_, i) => `p${i}`);
    const links = many.slice(1).map((id, i) => ({ a: many[i] ?? '', b: id }));
    const layout = computeLayout(many, links);
    const xs = [...layout.values()].map((p) => p.x);
    const ys = [...layout.values()].map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(GRAPH_SIZE.width * 0.5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(GRAPH_SIZE.height * 0.5);
  });

  it('keeps people roughly in place when a new connection arrives', () => {
    const before = computeLayout(ids, edges);
    const after = computeLayout(ids, [...edges, { id: 'e4', a: 'd', b: 'e', topicId: 't1' }], before);
    const moved = ids.map((id) => {
      const p = before.get(id);
      const q = after.get(id);
      return Math.hypot((p?.x ?? 0) - (q?.x ?? 0), (p?.y ?? 0) - (q?.y ?? 0));
    });
    expect(Math.max(...moved)).toBeLessThan(300);
  });

  it('ignores connections to people that are not in the picture and handles an empty game', () => {
    expect(computeLayout(['a'], [{ a: 'a', b: 'ghost' }]).size).toBe(1);
    expect(computeLayout([], []).size).toBe(0);
  });
});

describe('makeTopicColors', () => {
  it('gives topics stable, distinct colors and repeats them after the palette is used up', () => {
    const topics = Array.from({ length: TOPIC_COLORS.length + 2 }, (_, i) => ({ id: `t${String(i).padStart(2, '0')}`, name: `T${i}` }));
    const color = makeTopicColors(topics);
    expect(new Set(topics.slice(0, TOPIC_COLORS.length).map((t) => color(t.id))).size).toBe(TOPIC_COLORS.length);
    expect(color('t00')).toBe(color(`t${String(TOPIC_COLORS.length).padStart(2, '0')}`));
  });
});

describe('NetworkGraph', () => {
  const topicColor = makeTopicColors([
    { id: 't1', name: 'Dogs' },
    { id: 't2', name: 'Tennis' },
  ]);

  it('draws a dot per person and a line per connection', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} />);
    expect(screen.getAllByTestId('dot')).toHaveLength(5);
    expect(screen.getAllByTestId('edge')).toHaveLength(3);
  });

  it('shows names only when asked to', () => {
    const { rerender } = render(
      <NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} />,
    );
    expect(screen.queryByText('Person A')).not.toBeInTheDocument();
    rerender(<NetworkGraph nodes={nodes} edges={edges} showNames topicColor={topicColor} animate={false} />);
    expect(screen.getByText('Person A')).toBeInTheDocument();
  });

  it('colors lines by topic', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} />);
    const colors = screen.getAllByTestId('edge').map((e) => e.getAttribute('stroke'));
    expect(colors[0]).toBe(topicColor('t1'));
    expect(colors[2]).toBe(topicColor('t2'));
    expect(colors[0]).not.toBe(colors[2]);
  });

  it('draws two connections between the same pair as separate curves', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} />);
    const [first, , third] = screen.getAllByTestId('edge');
    expect(first?.getAttribute('d')).not.toBe(third?.getAttribute('d'));
  });

  it('pulses a ring around isolated people only when asked to', () => {
    const { container, rerender } = render(
      <NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} />,
    );
    expect(container.querySelectorAll('.ring')).toHaveLength(0);
    rerender(
      <NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} highlightIsolated />,
    );
    expect(container.querySelectorAll('.ring')).toHaveLength(2); // Person D and Person E
  });

  it('fades everything outside a focused topic', () => {
    const { container } = render(
      <NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} focusTopicId="t2" />,
    );
    expect(container.querySelectorAll('.edge.faded')).toHaveLength(2);
    expect(container.querySelectorAll('.dot.faded')).toHaveLength(3); // c, d, e are not in "Tennis"
  });

  it('is described for screen readers', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} showNames={false} topicColor={topicColor} animate={false} label="Network" />);
    expect(within(screen.getByRole('img', { name: 'Network' })).getAllByTestId('dot')).toHaveLength(5);
  });
});
