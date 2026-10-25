import type { Topic } from '@ctd/shared';

/** Distinct, bright colors that stay readable on the dark projector background. */
export const TOPIC_COLORS = [
  '#38bdf8',
  '#f472b6',
  '#facc15',
  '#4ade80',
  '#fb923c',
  '#a78bfa',
  '#2dd4bf',
  '#f87171',
  '#60a5fa',
  '#e879f9',
  '#a3e635',
  '#fbbf24',
] as const;

/**
 * Gives every topic its own color. Colors are assigned by topic id order, so a topic keeps its
 * color when others are renamed; with more topics than colors the colors repeat.
 */
export function makeTopicColors(topics: readonly Topic[]): (topicId: string) => string {
  const order = [...topics].map((t) => t.id).sort();
  const index = new Map(order.map((id, i) => [id, i]));
  return (topicId) => TOPIC_COLORS[(index.get(topicId) ?? 0) % TOPIC_COLORS.length] ?? TOPIC_COLORS[0];
}
