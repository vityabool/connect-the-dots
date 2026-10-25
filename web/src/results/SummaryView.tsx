import { summarize } from '@ctd/shared';
import { useMemo } from 'react';
import { strings } from '../strings';
import type { ViewProps } from './types';

/** One slide with the headline numbers of the game. */
export function SummaryView(props: ViewProps) {
  const { game, people, statEdges } = props;
  const summary = useMemo(() => summarize(people, game.topics, statEdges), [people, game.topics, statEdges]);

  return (
    <div className="view summary-card">
      <h2>{game.name}</h2>
      {summary.allConnected && <p className="celebrate">{strings.everyoneConnected}</p>}
      <dl className="summary-grid">
        <div>
          <dt>{strings.sumPeople}</dt>
          <dd>{summary.people}</dd>
        </div>
        <div>
          <dt>{strings.sumConnections}</dt>
          <dd>{summary.connections}</dd>
        </div>
        <div>
          <dt>{strings.sumTopics}</dt>
          <dd>{summary.topicsUsed}</dd>
        </div>
        <div>
          <dt>{strings.sumGroups}</dt>
          <dd>{summary.groups}</dd>
        </div>
        <div>
          <dt>{strings.sumAlone}</dt>
          <dd>{summary.isolated}</dd>
        </div>
      </dl>
      <div className="summary-highlights">
        <p>
          <span className="muted">{strings.sumTopTopic}</span>
          <strong>{summary.topTopic ? `${summary.topTopic.name} (${summary.topTopic.count})` : '–'}</strong>
        </p>
        <p>
          <span className="muted">{strings.sumTopConnector}</span>
          <strong>
            {summary.topConnector ? `${summary.topConnector.name} (${summary.topConnector.connections})` : '–'}
          </strong>
        </p>
      </div>
    </div>
  );
}
