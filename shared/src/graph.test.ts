import { describe, expect, it } from 'vitest';
import { connectedGroups, connectionKey } from './graph';

describe('connectionKey', () => {
  it('is the same regardless of which person comes first', () => {
    expect(connectionKey('p2', 'p1', 't1')).toBe(connectionKey('p1', 'p2', 't1'));
  });

  it('differs per topic so a pair can be linked on several topics', () => {
    expect(connectionKey('p1', 'p2', 't1')).not.toBe(connectionKey('p1', 'p2', 't2'));
  });
});

describe('connectedGroups', () => {
  it('puts everyone in one group when the network is connected', () => {
    const groups = connectedGroups(
      ['a', 'b', 'c', 'd'],
      [
        { a: 'a', b: 'b' },
        { a: 'c', b: 'b' },
        { a: 'd', b: 'c' },
      ],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reports isolated people as groups of one, largest group first', () => {
    const groups = connectedGroups(
      ['a', 'b', 'c', 'd', 'e'],
      [
        { a: 'a', b: 'b' },
        { a: 'b', b: 'c' },
      ],
    );
    expect(groups.map((group) => group.length)).toEqual([3, 1, 1]);
  });

  it('ignores connections to people that are not in the game', () => {
    const groups = connectedGroups(['a', 'b'], [{ a: 'a', b: 'ghost' }]);
    expect(groups).toHaveLength(2);
  });

  it('returns no groups for an empty game', () => {
    expect(connectedGroups([], [])).toEqual([]);
  });
});
