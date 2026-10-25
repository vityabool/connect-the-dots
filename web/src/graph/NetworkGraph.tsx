import { useEffect, useMemo, useRef, useState } from 'react';
import { computeLayout, GRAPH_SIZE, type Point } from './layout';

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  id: string;
  a: string;
  b: string;
  topicId: string;
}

interface Props {
  nodes: readonly GraphNode[];
  /** The lines to draw. */
  edges: readonly GraphEdge[];
  /** Lines that decide where people sit (defaults to `edges`); lets a replay keep the final layout. */
  layoutEdges?: readonly GraphEdge[];
  showNames: boolean;
  topicColor: (topicId: string) => string;
  /** Pulse a ring around people without any connection. */
  highlightIsolated?: boolean;
  /** Spotlight: draw everything else faded. */
  focusTopicId?: string;
  /** Move dots smoothly when the layout changes (turned off in tests and for reduced motion). */
  animate?: boolean;
  label?: string;
}

const TWEEN_MS = 700;

/** Space kept free around the dots: with names shown, long names beside dots at the edge must not be cut off. */
const PADDING_PLAIN = { x: 56, y: 56 };
const PADDING_WITH_NAMES = { x: 120, y: 76 };

/**
 * Colors and strokes are set as attributes on every SVG shape (not through CSS classes), so the SVG looks the
 * same when it is exported to an image: the export rebuilds the picture without the page's CSS rules for SVG
 * elements and anything colored only by a class would turn black (GitHub issue #2).
 */
const DOT_FILL = '#f8fafc';
const DOT_OUTLINE = '#0b1220';
const RING_COLOR = '#facc15';
const LABEL_COLOR = '#f8fafc';
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Smoothly interpolates dot positions towards `target` whenever it changes. */
function useTweened(target: Map<string, Point>, enabled: boolean): Map<string, Point> {
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (!enabled) return;
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = new Map<string, Point>();
      for (const [id, to] of target) {
        const origin = from.get(id) ?? to;
        next.set(id, { x: origin.x + (to.x - origin.x) * eased, y: origin.y + (to.y - origin.y) * eased });
      }
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return enabled ? shown : target;
}

export function NetworkGraph(props: Props) {
  const { nodes, edges, showNames, topicColor, highlightIsolated = false, focusTopicId, label } = props;
  const layoutEdges = props.layoutEdges ?? edges;
  const animate = (props.animate ?? true) && !prefersReducedMotion();

  const ids = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const lastLayout = useRef<Map<string, Point> | undefined>(undefined);
  const layout = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- warm start: reuse the previous layout so dots do not jump
    const next = computeLayout(ids, layoutEdges, lastLayout.current, GRAPH_SIZE, showNames ? PADDING_WITH_NAMES : PADDING_PLAIN);
    // eslint-disable-next-line react-hooks/refs -- remembered for the next layout
    lastLayout.current = next;
    return next;
  }, [ids, layoutEdges, showNames]);
  const positions = useTweened(layout, animate);

  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of edges) {
      counts.set(e.a, (counts.get(e.a) ?? 0) + 1);
      counts.set(e.b, (counts.get(e.b) ?? 0) + 1);
    }
    return counts;
  }, [edges]);

  const focusPeople = useMemo(() => {
    if (!focusTopicId) return undefined;
    const set = new Set<string>();
    for (const e of edges) {
      if (e.topicId === focusTopicId) {
        set.add(e.a);
        set.add(e.b);
      }
    }
    return set;
  }, [edges, focusTopicId]);

  // Parallel lines for people connected on several topics are drawn as separate curves.
  const curves = useMemo(() => {
    const groups = new Map<string, GraphEdge[]>();
    for (const e of edges) {
      const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
      const list = groups.get(key);
      if (list) list.push(e);
      else groups.set(key, [e]);
    }
    const offsets = new Map<string, number>();
    for (const list of groups.values()) {
      list.forEach((e, i) => offsets.set(e.id, (i - (list.length - 1) / 2) * 34));
    }
    return offsets;
  }, [edges]);

  return (
    <svg
      className="network"
      viewBox={`0 0 ${GRAPH_SIZE.width} ${GRAPH_SIZE.height}`}
      role="img"
      aria-label={label ?? 'Connection graph'}
      fontFamily={FONT}
    >
      <g>
        {edges.map((edge) => {
          const from = positions.get(edge.a);
          const to = positions.get(edge.b);
          if (!from || !to) return null;
          const offset = curves.get(edge.id) ?? 0;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.hypot(dx, dy) || 1;
          const cx = mx + (-dy / length) * offset;
          const cy = my + (dx / length) * offset;
          const faded = focusTopicId !== undefined && edge.topicId !== focusTopicId;
          return (
            <path
              key={edge.id}
              className={`edge${faded ? ' faded' : ''}`}
              data-testid="edge"
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
              pathLength={1}
              fill="none"
              stroke={topicColor(edge.topicId)}
              strokeWidth={3.5}
              strokeLinecap="round"
              opacity={faded ? 0.08 : 0.9}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((node) => {
          const point = positions.get(node.id);
          if (!point) return null;
          const links = degree.get(node.id) ?? 0;
          const radius = 9 + Math.min(links, 10) * 1.6;
          const isolated = links === 0;
          const faded = focusPeople !== undefined && !focusPeople.has(node.id);
          return (
            <g
              key={node.id}
              className={`dot${faded ? ' faded' : ''}`}
              data-testid="dot"
              transform={`translate(${point.x} ${point.y})`}
              opacity={faded ? 0.2 : 1}
            >
              {highlightIsolated && isolated && (
                <circle className="ring" r={radius + 8} fill="none" stroke={RING_COLOR} strokeWidth={3} />
              )}
              <circle className="dot-body" r={radius} fill={DOT_FILL} stroke={DOT_OUTLINE} strokeWidth={3} />
              {showNames && (
                <text
                  className="dot-label"
                  y={radius + 17}
                  textAnchor="middle"
                  fill={LABEL_COLOR}
                  fontSize={17}
                  fontWeight={600}
                  stroke={DOT_OUTLINE}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
