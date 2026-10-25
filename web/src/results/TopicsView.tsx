import { topTopics } from '@ctd/shared';
import { useMemo, useState } from 'react';
import { NetworkGraph } from '../graph/NetworkGraph';
import { strings } from '../strings';
import type { ViewProps } from './types';

/** Bar chart of the most used topics; clicking a bar highlights those lines on the graph. */
export function TopicsView(props: ViewProps) {
  const { game, nodes, edges, statEdges, topicColor, animate } = props;
  const [selected, setSelected] = useState<string | undefined>();
  const ranked = useMemo(() => topTopics(game.topics, statEdges).filter((t) => t.count > 0), [game.topics, statEdges]);
  const max = ranked[0]?.count ?? 1;

  if (ranked.length === 0) return <p className="empty">{strings.noConnectionsYet}</p>;

  return (
    <div className="view view-split">
      <ol className="bars" aria-label={strings.viewTopics}>
        {ranked.map((topic) => (
          <li key={topic.topicId}>
            <button
              type="button"
              className={`bar-row${selected === topic.topicId ? ' selected' : ''}`}
              aria-pressed={selected === topic.topicId}
              onClick={() => setSelected(selected === topic.topicId ? undefined : topic.topicId)}
            >
              <span className="bar-name">{topic.name}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${(topic.count / max) * 100}%`, background: topicColor(topic.topicId) }}
                />
              </span>
              <span className="bar-count">{topic.count}</span>
            </button>
          </li>
        ))}
      </ol>
      <div>
        <NetworkGraph
          nodes={nodes}
          edges={edges}
          showNames={false}
          topicColor={topicColor}
          focusTopicId={selected}
          animate={animate}
          label={strings.graphLabel}
        />
        <p className="muted">{strings.topicsHint}</p>
      </div>
    </div>
  );
}
