import type { GameDetails } from '@ctd/shared';
import { useState } from 'react';
import { adminApi } from '../api';
import { strings } from '../strings';
import { formatDateTime, messageOf } from './format';

interface Props {
  game: GameDetails;
  onChanged: (notice: string) => void;
  onError: (message: string) => void;
}

const MAX_ROWS = 200;

/** All connections of the game, searchable, with delete for the facilitator. */
export function ConnectionsManager({ game, onChanged, onError }: Props) {
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const needle = filter.trim().toLowerCase();
  const matching = game.connections.filter(
    (c) => !needle || `${c.aName} ${c.bName} ${c.topicName}`.toLowerCase().includes(needle),
  );

  async function remove(id: string, label: string) {
    if (!window.confirm(strings.confirmDeleteAnyConnection(label))) return;
    setBusy(true);
    try {
      await adminApi.deleteConnection(game.id, id);
      onChanged(strings.connectionDeleted);
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>
        {strings.connections} ({game.connections.length})
      </h3>
      {game.connections.length === 0 ? (
        <p>{strings.noConnectionsYet}</p>
      ) : (
        <>
          <label htmlFor="connection-filter" className="muted">
            {strings.filterConnections}
          </label>
          <input
            id="connection-filter"
            className="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className="people">
            {matching.slice(0, MAX_ROWS).map((c) => {
              const label = `${c.aName} ↔ ${c.bName}: ${c.topicName}`;
              return (
                <li key={c.id}>
                  <span>
                    {label} <span className="muted">· {formatDateTime(c.createdAt)}</span>
                  </span>
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    aria-label={`${strings.deleteConnection} ${label}`}
                    onClick={() => void remove(c.id, label)}
                  >
                    {strings.deleteConnection}
                  </button>
                </li>
              );
            })}
          </ul>
          {matching.length > MAX_ROWS && <p className="muted">{strings.showingFirst(MAX_ROWS, matching.length)}</p>}
        </>
      )}
    </section>
  );
}
