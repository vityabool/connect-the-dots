import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { SimulationNodeDatum } from 'd3-force';

export interface Point {
  x: number;
  y: number;
}

export interface LayoutEdge {
  a: string;
  b: string;
}

export const GRAPH_SIZE = { width: 1000, height: 600 } as const;
const DEFAULT_PADDING = { x: 56, y: 56 };
const MAX_ZOOM = 2.2;

interface LayoutNode extends SimulationNodeDatum {
  id: string;
}

/**
 * Positions the people with a force-directed layout: connected people attract each other,
 * everyone repels everyone. Pass the previous positions to keep existing dots roughly in place
 * when the graph changes (new people start on a circle around the center).
 * The result is deterministic: the same input always gives the same picture.
 */
export function computeLayout(
  nodeIds: readonly string[],
  edges: readonly LayoutEdge[],
  previous?: ReadonlyMap<string, Point>,
  size: { width: number; height: number } = GRAPH_SIZE,
  /** Free space kept around the picture (for example for names beside the dots). */
  padding: { x: number; y: number } = DEFAULT_PADDING,
): Map<string, Point> {
  const { width, height } = size;
  const radius = Math.min(width, height) * 0.35;

  const nodes: LayoutNode[] = nodeIds.map((id, index) => {
    const before = previous?.get(id);
    if (before) return { id, x: before.x, y: before.y };
    const angle = (2 * Math.PI * index) / Math.max(nodeIds.length, 1);
    return { id, x: width / 2 + radius * Math.cos(angle), y: height / 2 + radius * Math.sin(angle) };
  });

  // Several connections between the same two people pull as hard as one.
  const known = new Set(nodeIds);
  const seen = new Set<string>();
  const links: { source: string; target: string }[] = [];
  for (const { a, b } of edges) {
    if (a === b || !known.has(a) || !known.has(b)) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: a, target: b });
  }

  const simulation = forceSimulation(nodes)
    .force('link', forceLink<LayoutNode, { source: string; target: string }>(links).id((n) => n.id).distance(95).strength(0.45))
    .force('charge', forceManyBody().strength(-280))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX(width / 2).strength(0.1))
    .force('y', forceY(height / 2).strength(0.15))
    .force('collide', forceCollide(30))
    .alpha(previous && previous.size > 0 ? 0.35 : 1)
    .stop();
  simulation.tick(previous && previous.size > 0 ? 150 : 320);

  return fitToArea(nodes, width, height, padding);
}

/**
 * Scales and centers the picture so it uses the available area (a small group is enlarged, but
 * never more than MAX_ZOOM so two dots are not drawn absurdly far apart).
 */
function fitToArea(
  nodes: readonly LayoutNode[],
  width: number,
  height: number,
  padding: { x: number; y: number },
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (nodes.length === 0) return positions;

  const xs = nodes.map((n) => n.x ?? width / 2);
  const ys = nodes.map((n) => n.y ?? height / 2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boxWidth = Math.max(maxX - minX, 1);
  const boxHeight = Math.max(maxY - minY, 1);
  const scale = Math.min(MAX_ZOOM, (width - 2 * padding.x) / boxWidth, (height - 2 * padding.y) / boxHeight);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  nodes.forEach((node, i) => {
    positions.set(node.id, {
      x: width / 2 + ((xs[i] ?? centerX) - centerX) * scale,
      y: height / 2 + ((ys[i] ?? centerY) - centerY) * scale,
    });
  });
  return positions;
}
