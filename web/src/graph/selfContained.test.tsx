import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatrixView } from '../results/MatrixView';
import type { ViewProps } from '../results/types';
import { NetworkGraph, type GraphEdge, type GraphNode } from './NetworkGraph';
import { makeTopicColors } from './palette';

// Image export (html-to-image) rebuilds the picture without the page's CSS rules for SVG shapes, so
// everything that is only colored by a CSS class turns black (GitHub issue #2). These tests make sure
// every SVG shape carries its own colors as attributes, so the SVG looks right with no stylesheet at all.

const nodes: GraphNode[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: `Person ${id.toUpperCase()}` }));
const edges: GraphEdge[] = [
  { id: 'e1', a: 'a', b: 'b', topicId: 't1' },
  { id: 'e2', a: 'a', b: 'b', topicId: 't2' },
  { id: 'e3', a: 'b', b: 'c', topicId: 't1' },
];
const topicColor = makeTopicColors([
  { id: 't1', name: 'Dogs' },
  { id: 't2', name: 'Tennis' },
]);

const matrixProps = (): ViewProps => ({
  game: {
    id: 'g',
    name: 'Game',
    code: '123456',
    createdAt: '2026-10-17T09:00:00.000Z',
    expiresAt: '2026-10-20T09:00:00.000Z',
    expired: false,
    participants: nodes.map((n) => ({ id: n.id, name: n.label })),
    topics: [
      { id: 't1', name: 'Dogs' },
      { id: 't2', name: 'Tennis' },
    ],
    connections: [],
    settings: { shortUrl: '', rulesText: '', timerMinutes: 30, showNames: false },
    timer: { state: 'idle', minutes: 30, remainingSec: 1800 },
    version: 1,
  },
  people: nodes.map((n) => ({ id: n.id, name: n.label })),
  nodes,
  edges,
  statEdges: edges.map((e, i) => ({ id: e.id, a: e.a, b: e.b, topicId: e.topicId, createdAt: `2026-10-17T10:0${i}:00.000Z` })),
  topicColor,
  animate: false,
});

function attr(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

describe('network graph SVG is self-contained (no CSS needed for colors)', () => {
  function renderGraph(props: { showNames?: boolean; highlightIsolated?: boolean; focusTopicId?: string } = {}) {
    return render(
      <NetworkGraph nodes={nodes} edges={edges} showNames={props.showNames ?? true} topicColor={topicColor} animate={false} highlightIsolated={props.highlightIsolated ?? true} focusTopicId={props.focusTopicId} />,
    ).container;
  }

  it('draws dots in white with a dark outline, set on the circle itself', () => {
    const container = renderGraph();
    const bodies = container.querySelectorAll('circle.dot-body');
    expect(bodies.length).toBe(4);
    for (const body of bodies) {
      expect(attr(body, 'fill')).toBe('#f8fafc');
      expect(attr(body, 'stroke')).toBe('#0b1220');
      expect(attr(body, 'stroke-width')).toBe('3');
    }
  });

  it('gives names a white fill with a dark halo, set on the text itself', () => {
    const container = renderGraph();
    const labels = container.querySelectorAll('text.dot-label');
    expect(labels.length).toBe(4);
    for (const label of labels) {
      expect(attr(label, 'fill')).toBe('#f8fafc');
      expect(attr(label, 'stroke')).toBe('#0b1220');
      expect(attr(label, 'stroke-width')).not.toBeNull();
      expect(attr(label, 'font-size')).not.toBeNull();
      expect(attr(label, 'paint-order')).toBe('stroke');
    }
  });

  it('draws lines without a fill, colored by topic, set on the path itself', () => {
    const container = renderGraph();
    const paths = container.querySelectorAll('path.edge');
    expect(paths.length).toBe(3);
    for (const path of paths) {
      expect(attr(path, 'fill')).toBe('none');
      expect(attr(path, 'stroke')).toMatch(/^#[0-9a-f]{6}$/i);
      expect(attr(path, 'stroke-width')).not.toBeNull();
      expect(attr(path, 'stroke-linecap')).toBe('round');
    }
  });

  it('draws the ring around isolated people with its own stroke and no fill', () => {
    const container = renderGraph({ highlightIsolated: true });
    const rings = container.querySelectorAll('circle.ring');
    expect(rings.length).toBe(1); // Person D has no connection
    expect(attr(rings[0] as Element, 'fill')).toBe('none');
    expect(attr(rings[0] as Element, 'stroke')).toBe('#facc15');
  });

  it('expresses fading with attributes too (spotlight)', () => {
    const container = renderGraph({ focusTopicId: 't2' });
    const faded = [...container.querySelectorAll('path.edge')].filter((p) => p.classList.contains('faded'));
    expect(faded).toHaveLength(2);
    for (const path of faded) expect(Number(attr(path, 'opacity'))).toBeLessThan(0.2);
    const normal = [...container.querySelectorAll('path.edge')].filter((p) => !p.classList.contains('faded'));
    for (const path of normal) expect(Number(attr(path, 'opacity'))).toBeGreaterThan(0.5);
    const fadedDots = [...container.querySelectorAll('g.dot.faded')];
    expect(fadedDots.length).toBeGreaterThan(0);
    for (const dot of fadedDots) expect(Number(attr(dot, 'opacity'))).toBeLessThan(0.5);
  });

  it('sets the font on the svg so labels do not fall back to a serif font', () => {
    const container = renderGraph();
    expect(attr(container.querySelector('svg') as Element, 'font-family')).toMatch(/sans-serif/);
  });

  it('every visible shape has an explicit fill', () => {
    const container = renderGraph();
    for (const shape of container.querySelectorAll('svg path, svg circle, svg text')) {
      expect(attr(shape, 'fill'), `${shape.tagName}.${shape.getAttribute('class')} has no fill attribute`).not.toBeNull();
    }
  });
});

describe('matrix SVG is self-contained (no CSS needed for colors)', () => {
  it('gives names, empty, filled and diagonal squares their own colors', () => {
    const { container } = render(<MatrixView {...matrixProps()} />);
    const labels = container.querySelectorAll('text.matrix-label');
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(attr(label, 'fill')).toBe('#e2e8f0');

    const filled = container.querySelectorAll('rect.matrix-cell.filled');
    expect(filled.length).toBe(4); // pairs a-b and b-c, both directions
    for (const cell of filled) {
      expect(attr(cell, 'fill')).toBe('#38bdf8');
      expect(attr(cell, 'opacity')).not.toBeNull();
    }

    const empty = container.querySelectorAll('rect.matrix-cell:not(.filled)');
    expect(empty.length).toBeGreaterThan(0);
    for (const cell of empty) expect(attr(cell, 'fill')).toBe('#1e293b');

    const self = container.querySelectorAll('rect.matrix-self');
    expect(self.length).toBe(4);
    for (const cell of self) expect(attr(cell, 'fill')).toBe('#334155');
  });

  it('every shape has an explicit fill and the svg sets the font', () => {
    const { container } = render(<MatrixView {...matrixProps()} />);
    for (const shape of container.querySelectorAll('svg rect, svg text')) {
      expect(attr(shape, 'fill'), `${shape.tagName}.${shape.getAttribute('class')} has no fill attribute`).not.toBeNull();
    }
    expect(attr(container.querySelector('svg') as Element, 'font-family')).toMatch(/sans-serif/);
  });
});
