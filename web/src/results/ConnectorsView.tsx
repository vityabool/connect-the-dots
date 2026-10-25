import { superConnectors } from '@ctd/shared';
import { useMemo } from 'react';
import { strings } from '../strings';
import type { ViewProps } from './types';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Leaderboard of the most connected people. */
export function ConnectorsView(props: ViewProps) {
  const ranked = useMemo(() => superConnectors(props.people, props.statEdges), [props.people, props.statEdges]);
  const top = ranked[0];
  if (!top) return <p className="empty">{strings.noConnectionsYet}</p>;

  return (
    <div className="view">
      <p className="hero">
        {strings.connectorOfTheDay}: <strong>{top.name}</strong> ({strings.connectorLine(top.connections, top.partners)})
      </p>
      <table className="leaderboard">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{strings.colPerson}</th>
            <th scope="col">{strings.colConnections}</th>
            <th scope="col">{strings.colPartners}</th>
            <th scope="col">{strings.colTopics}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.slice(0, 15).map((person, index) => (
            <tr key={person.personId}>
              <td>{MEDALS[index] ?? index + 1}</td>
              <th scope="row">{person.name}</th>
              <td>{person.connections}</td>
              <td>{person.partners}</td>
              <td>{person.topics}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
