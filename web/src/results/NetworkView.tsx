import { networkCounts } from '@ctd/shared';
import { useMemo } from 'react';
import { NetworkGraph } from '../graph/NetworkGraph';
import { strings } from '../strings';
import { TopicLegend } from './TopicLegend';
import type { ViewProps } from './types';

/** The full network with names, topic-colored lines, dot size by connections, isolated people pulsing. */
export function NetworkView(props: ViewProps) {
  const { game, nodes, edges, people, statEdges, topicColor, animate } = props;
  const counts = useMemo(() => networkCounts(people, statEdges), [people, statEdges]);
  const used = useMemo(() => new Set(edges.map((e) => e.topicId)), [edges]);

  return (
    <div className="view">
      <NetworkGraph
        nodes={nodes}
        edges={edges}
        showNames
        topicColor={topicColor}
        highlightIsolated
        animate={animate}
        label={strings.graphLabel}
      />
      <TopicLegend topics={game.topics} topicColor={topicColor} usedTopicIds={used} />
      <ul className="counters" aria-label={strings.countersLabel}>
        <li>
          <strong>{counts.connections}</strong> {strings.counterConnections}
        </li>
        <li>
          <strong>{counts.groups}</strong> {strings.counterGroups}
        </li>
        <li>
          <strong>{counts.isolated}</strong> {strings.counterIsolated}
        </li>
      </ul>
    </div>
  );
}
