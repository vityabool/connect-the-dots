import { describe, expect, it } from 'vitest';
import {
  networkCounts,
  pairCountKey,
  pairCounts,
  summarize,
  superConnectors,
  timeline,
  topTopics,
  unexpectedLinks,
  type StatEdge,
} from './stats';

const people = ['anna', 'ivan', 'olena', 'maksym', 'iryna'].map((id) => ({ id, name: id[0]?.toUpperCase() + id.slice(1) }));
const topics = [
  { id: 'dogs', name: 'Dogs' },
  { id: 'tennis', name: 'Tennis' },
  { id: 'chess', name: 'Chess' },
  { id: 'unused', name: 'Unused' },
];
const edge = (id: string, a: string, b: string, topicId: string, minute: number): StatEdge => ({
  id,
  a,
  b,
  topicId,
  createdAt: `2026-10-17T10:${String(minute).padStart(2, '0')}:00.000Z`,
});
const edges: StatEdge[] = [
  edge('e1', 'anna', 'ivan', 'dogs', 5),
  edge('e2', 'anna', 'olena', 'dogs', 3),
  edge('e3', 'ivan', 'olena', 'tennis', 8),
  edge('e4', 'anna', 'ivan', 'tennis', 1),
  edge('e5', 'maksym', 'anna', 'chess', 9),
];

describe('networkCounts', () => {
  it('counts groups and isolated people', () => {
    expect(networkCounts(people, edges)).toEqual({
      people: 5,
      connections: 5,
      groups: 2,
      isolated: 1,
      allConnected: false,
    });
  });

  it('detects the single-network goal', () => {
    const all = [...edges, edge('e6', 'iryna', 'maksym', 'chess', 10)];
    expect(networkCounts(people, all)).toMatchObject({ groups: 1, isolated: 0, allConnected: true });
  });

  it('is never "all connected" for an empty or one-person game', () => {
    expect(networkCounts([], []).allConnected).toBe(false);
    expect(networkCounts(people.slice(0, 1), []).allConnected).toBe(false);
  });
});

describe('topTopics', () => {
  it('ranks topics by use, including unused ones last', () => {
    expect(topTopics(topics, edges)).toEqual([
      { topicId: 'dogs', name: 'Dogs', count: 2 },
      { topicId: 'tennis', name: 'Tennis', count: 2 },
      { topicId: 'chess', name: 'Chess', count: 1 },
      { topicId: 'unused', name: 'Unused', count: 0 },
    ]);
  });
});

describe('superConnectors', () => {
  it('ranks by connections, then partners, then topics, and skips people without connections', () => {
    const ranked = superConnectors(people, edges);
    expect(ranked.map((r) => r.name)).toEqual(['Anna', 'Ivan', 'Olena', 'Maksym']);
    expect(ranked[0]).toEqual({ personId: 'anna', name: 'Anna', connections: 4, partners: 3, topics: 3 });
    expect(ranked[1]).toMatchObject({ name: 'Ivan', connections: 3, partners: 2, topics: 2 });
  });
});

describe('unexpectedLinks', () => {
  it('lists connections on rare topics, rarest first', () => {
    const links = unexpectedLinks(people, topics, edges, 1);
    expect(links).toEqual([{ edgeId: 'e5', aName: 'Maksym', bName: 'Anna', topicName: 'Chess', topicUses: 1 }]);
  });

  it('uses 2 as the default limit', () => {
    expect(unexpectedLinks(people, topics, edges).map((l) => l.topicUses)).toEqual([1, 2, 2, 2, 2]);
  });
});

describe('pairCounts', () => {
  it('counts connections per pair regardless of direction', () => {
    const counts = pairCounts(edges);
    expect(counts.get(pairCountKey('anna', 'ivan'))).toBe(2);
    expect(counts.get(pairCountKey('ivan', 'anna'))).toBe(2);
    expect(counts.get(pairCountKey('ivan', 'olena'))).toBe(1);
    expect(counts.get(pairCountKey('iryna', 'anna'))).toBeUndefined();
  });
});

describe('timeline', () => {
  it('orders connections by creation time', () => {
    expect(timeline(edges).map((e) => e.id)).toEqual(['e4', 'e2', 'e1', 'e3', 'e5']);
  });
});

describe('summarize', () => {
  it('collects the headline numbers', () => {
    const s = summarize(people, topics, edges);
    expect(s).toMatchObject({ people: 5, connections: 5, topicsUsed: 3, groups: 2, isolated: 1, allConnected: false });
    expect(s.topTopic).toEqual({ topicId: 'dogs', name: 'Dogs', count: 2 });
    expect(s.topConnector?.name).toBe('Anna');
  });

  it('has no top topic or connector for an empty game', () => {
    const s = summarize(people, topics, []);
    expect(s.topTopic).toBeUndefined();
    expect(s.topConnector).toBeUndefined();
    expect(s.connections).toBe(0);
  });
});
