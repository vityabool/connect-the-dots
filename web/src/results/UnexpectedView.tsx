import { unexpectedLinks } from '@ctd/shared';
import { useMemo } from 'react';
import { strings } from '../strings';
import type { ViewProps } from './types';

/** Connections on rare topics: the surprising things people found in common. */
export function UnexpectedView(props: ViewProps) {
  const { game, people, statEdges, topicColor } = props;
  const topicIdOfName = useMemo(() => new Map(game.topics.map((t) => [t.name, t.id])), [game.topics]);
  const links = useMemo(() => unexpectedLinks(people, game.topics, statEdges, 2), [people, game.topics, statEdges]);

  if (links.length === 0) return <p className="empty">{strings.noUnexpected}</p>;

  return (
    <div className="view">
      <p className="muted">{strings.unexpectedHint}</p>
      <ul className="link-list">
        {links.slice(0, 20).map((link) => (
          <li key={link.edgeId}>
            <span
              className="swatch"
              style={{ background: topicColor(topicIdOfName.get(link.topicName) ?? '') }}
              aria-hidden="true"
            />
            <span className="link-people">
              {link.aName} ↔ {link.bName}
            </span>
            <span className="link-topic">{link.topicName}</span>
            <span className="muted">{strings.usedTimes(link.topicUses)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
