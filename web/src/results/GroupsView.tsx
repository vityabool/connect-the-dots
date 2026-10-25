import { connectedGroups, networkCounts } from '@ctd/shared';
import { useMemo } from 'react';
import { NetworkGraph } from '../graph/NetworkGraph';
import { strings } from '../strings';
import type { ViewProps } from './types';

/** How many separate groups remain, who is still alone, and the "everyone is connected" moment. */
export function GroupsView(props: ViewProps) {
  const { nodes, edges, people, statEdges, topicColor, animate } = props;
  const counts = useMemo(() => networkCounts(people, statEdges), [people, statEdges]);
  const groups = useMemo(
    () =>
      connectedGroups(
        people.map((p) => p.id),
        statEdges,
      ),
    [people, statEdges],
  );
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const alone = groups.filter((g) => g.length === 1).map((g) => nameOf.get(g[0] ?? '') ?? '');
  const bigGroups = groups.filter((g) => g.length > 1);

  return (
    <div className="view view-split">
      <div>
        {counts.allConnected ? (
          <p className="celebrate">{strings.everyoneConnected}</p>
        ) : (
          <p className="hero">{strings.groupsStatus(counts.groups, counts.isolated)}</p>
        )}
        {bigGroups.map((group, index) => (
          <section key={group.join('|')} className="group-card">
            <h3>{strings.groupTitle(index + 1, group.length)}</h3>
            <p>{group.map((id) => nameOf.get(id) ?? '').join(', ')}</p>
          </section>
        ))}
        {alone.length > 0 && (
          <section className="group-card group-alone">
            <h3>{strings.stillAlone(alone.length)}</h3>
            <p>{alone.join(', ')}</p>
          </section>
        )}
      </div>
      <NetworkGraph
        nodes={nodes}
        edges={edges}
        showNames
        topicColor={topicColor}
        highlightIsolated
        animate={animate}
        label={strings.graphLabel}
      />
    </div>
  );
}
