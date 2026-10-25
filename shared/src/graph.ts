export interface Edge {
  a: string;
  b: string;
}

/**
 * Row key of a connection: the same pair + the same topic always produces the same key,
 * whichever person is listed first. This makes duplicate connections impossible in Table Storage.
 */
export function connectionKey(personA: string, personB: string, topicId: string): string {
  const [first, second] = personA < personB ? [personA, personB] : [personB, personA];
  return `${first}:${second}:${topicId}`;
}

/**
 * Splits people into connected groups (the "Connect the Network" goal is a single group).
 * People without any connection form a group of one. Groups are sorted largest first.
 */
export function connectedGroups(people: readonly string[], edges: readonly Edge[]): string[][] {
  const parent = new Map<string, string>();
  for (const person of people) parent.set(person, person);

  const find = (person: string): string => {
    let root = person;
    for (let next = parent.get(root); next !== undefined && next !== root; next = parent.get(root)) {
      root = next;
    }
    // Path compression.
    let current = person;
    while (current !== root) {
      const next = parent.get(current) ?? root;
      parent.set(current, root);
      current = next;
    }
    return root;
  };

  for (const { a, b } of edges) {
    if (!parent.has(a) || !parent.has(b)) continue;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  const groups = new Map<string, string[]>();
  for (const person of people) {
    const root = find(person);
    const members = groups.get(root);
    if (members) members.push(person);
    else groups.set(root, [person]);
  }
  return [...groups.values()].sort((x, y) => y.length - x.length);
}
