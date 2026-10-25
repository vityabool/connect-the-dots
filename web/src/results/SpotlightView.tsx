import { topTopics } from '@ctd/shared';
import { useMemo, useState } from 'react';
import { NetworkGraph } from '../graph/NetworkGraph';
import { strings } from '../strings';
import type { ViewProps } from './types';

/** Pick a topic and see only the people (and lines) that share it. */
export function SpotlightView(props: ViewProps) {
  const { game, nodes, edges, statEdges, topicColor, animate } = props;
  const topics = useMemo(() => topTopics(game.topics, statEdges).filter((t) => t.count > 0), [game.topics, statEdges]);
  const [chosen, setChosen] = useState<string | undefined>();
  const topicId = chosen && topics.some((t) => t.topicId === chosen) ? chosen : topics[0]?.topicId;

  const people = useMemo(() => {
    const names = new Map(nodes.map((n) => [n.id, n.label]));
    const ids = new Set<string>();
    for (const e of edges) {
      if (e.topicId === topicId) {
        ids.add(e.a);
        ids.add(e.b);
      }
    }
    return [...ids].map((id) => names.get(id) ?? '').sort((a, b) => a.localeCompare(b));
  }, [nodes, edges, topicId]);

  if (!topicId) return <p className="empty">{strings.noConnectionsYet}</p>;
  const topic = topics.find((t) => t.topicId === topicId);

  return (
    <div className="view view-split">
      <div>
        <label htmlFor="spotlight-topic" className="muted">
          {strings.spotlightPick}
        </label>
        <select id="spotlight-topic" value={topicId} onChange={(e) => setChosen(e.target.value)}>
          {topics.map((t) => (
            <option key={t.topicId} value={t.topicId}>
              {t.name} ({t.count})
            </option>
          ))}
        </select>
        <h3 style={{ color: topicColor(topicId) }}>{strings.spotlightPeople(topic?.name ?? '', people.length)}</h3>
        <ul className="name-list">
          {people.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
      <NetworkGraph
        nodes={nodes}
        edges={edges}
        showNames
        topicColor={topicColor}
        focusTopicId={topicId}
        animate={animate}
        label={strings.graphLabel}
      />
    </div>
  );
}
