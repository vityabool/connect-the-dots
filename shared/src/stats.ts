import { connectedGroups } from './graph';

/** The minimum a statistic needs to know about a person, a topic and a connection. */
export interface StatPerson {
  id: string;
  name: string;
}

export interface StatTopic {
  id: string;
  name: string;
}

export interface StatEdge {
  id: string;
  a: string;
  b: string;
  topicId: string;
  createdAt: string;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface NetworkCounts {
  people: number;
  connections: number;
  /** Separate groups of people (a person without connections is a group of one). */
  groups: number;
  /** People without any connection yet. */
  isolated: number;
  /** True when everyone belongs to one connected network (the Round 3 goal). */
  allConnected: boolean;
}

export function networkCounts(people: readonly StatPerson[], edges: readonly StatEdge[]): NetworkCounts {
  const groups = connectedGroups(
    people.map((p) => p.id),
    edges,
  );
  return {
    people: people.length,
    connections: edges.length,
    groups: groups.length,
    isolated: groups.filter((g) => g.length === 1).length,
    allConnected: people.length > 1 && groups.length === 1,
  };
}

export interface TopicCount {
  topicId: string;
  name: string;
  count: number;
}

/** Topics by number of connections, most used first (topics nobody used are included with 0). */
export function topTopics(topics: readonly StatTopic[], edges: readonly StatEdge[]): TopicCount[] {
  const counts = new Map<string, number>();
  for (const e of edges) counts.set(e.topicId, (counts.get(e.topicId) ?? 0) + 1);
  return topics
    .map((t) => ({ topicId: t.id, name: t.name, count: counts.get(t.id) ?? 0 }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
}

export interface ConnectorStat {
  personId: string;
  name: string;
  /** Number of connections this person is part of. */
  connections: number;
  /** Number of different people they are connected with. */
  partners: number;
  /** Number of different topics they connected on. */
  topics: number;
}

/** People ranked by how connected they are: connections, then different partners, then topics. */
export function superConnectors(people: readonly StatPerson[], edges: readonly StatEdge[]): ConnectorStat[] {
  const stats = new Map<string, { connections: number; partners: Set<string>; topics: Set<string> }>();
  const entry = (id: string) => {
    let value = stats.get(id);
    if (!value) {
      value = { connections: 0, partners: new Set(), topics: new Set() };
      stats.set(id, value);
    }
    return value;
  };
  for (const e of edges) {
    for (const [self, other] of [
      [e.a, e.b],
      [e.b, e.a],
    ] as const) {
      const s = entry(self);
      s.connections += 1;
      s.partners.add(other);
      s.topics.add(e.topicId);
    }
  }
  return people
    .filter((p) => (stats.get(p.id)?.connections ?? 0) > 0)
    .map((p) => {
      const s = stats.get(p.id);
      return {
        personId: p.id,
        name: p.name,
        connections: s?.connections ?? 0,
        partners: s?.partners.size ?? 0,
        topics: s?.topics.size ?? 0,
      };
    })
    .sort((x, y) => y.connections - x.connections || y.partners - x.partners || y.topics - x.topics || x.name.localeCompare(y.name));
}

export interface UnexpectedLink {
  edgeId: string;
  aName: string;
  bName: string;
  topicName: string;
  /** How many connections in the whole game use this topic (small = rare). */
  topicUses: number;
}

/** Connections made on rare topics (used at most `maxUses` times), rarest first. */
export function unexpectedLinks(
  people: readonly StatPerson[],
  topics: readonly StatTopic[],
  edges: readonly StatEdge[],
  maxUses = 2,
): UnexpectedLink[] {
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const uses = new Map<string, number>();
  for (const e of edges) uses.set(e.topicId, (uses.get(e.topicId) ?? 0) + 1);

  return edges
    .filter((e) => (uses.get(e.topicId) ?? 0) <= maxUses)
    .map((e) => ({
      edgeId: e.id,
      aName: nameOf.get(e.a) ?? '',
      bName: nameOf.get(e.b) ?? '',
      topicName: topicName.get(e.topicId) ?? '',
      topicUses: uses.get(e.topicId) ?? 0,
    }))
    .sort((x, y) => x.topicUses - y.topicUses || x.topicName.localeCompare(y.topicName) || x.aName.localeCompare(y.aName));
}

/** Number of connections between each pair of people, keyed by `pairCountKey`. */
export function pairCounts(edges: readonly StatEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of edges) {
    const key = pairKey(e.a, e.b);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function pairCountKey(a: string, b: string): string {
  return pairKey(a, b);
}

/** Connections in the order they were made (for the replay). */
export function timeline(edges: readonly StatEdge[]): StatEdge[] {
  return [...edges].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id));
}

export interface GameStats {
  people: number;
  connections: number;
  /** Topics that were used at least once. */
  topicsUsed: number;
  groups: number;
  isolated: number;
  allConnected: boolean;
  topTopic?: TopicCount;
  topConnector?: ConnectorStat;
}

export function summarize(
  people: readonly StatPerson[],
  topics: readonly StatTopic[],
  edges: readonly StatEdge[],
): GameStats {
  const counts = networkCounts(people, edges);
  const ranked = topTopics(topics, edges);
  const top = ranked[0];
  return {
    people: counts.people,
    connections: counts.connections,
    topicsUsed: ranked.filter((t) => t.count > 0).length,
    groups: counts.groups,
    isolated: counts.isolated,
    allConnected: counts.allConnected,
    topTopic: top && top.count > 0 ? top : undefined,
    topConnector: superConnectors(people, edges)[0],
  };
}
