import type { GameDetails } from '@ctd/shared';
import { useState } from 'react';
import { adminApi } from '../api';
import { strings } from '../strings';
import { messageOf } from './format';

interface Props {
  game: GameDetails;
  /** Called after a change so the page can show a message and reload. */
  onChanged: (notice: string) => void;
  onError: (message: string) => void;
}

/** The topic list of a game with delete (and its connections) and merge actions. */
export function TopicsManager({ game, onChanged, onError }: Props) {
  const [mergeInto, setMergeInto] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const countOf = (topicId: string) => game.connections.filter((c) => c.topicId === topicId).length;

  async function remove(topicId: string, name: string) {
    const count = countOf(topicId);
    if (!window.confirm(strings.confirmDeleteTopic(name, count))) return;
    setBusy(true);
    try {
      const result = await adminApi.deleteTopic(game.id, topicId);
      onChanged(strings.topicDeleted(name, result.deletedConnections));
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function merge(sourceId: string, sourceName: string) {
    const targetId = mergeInto[sourceId];
    const target = game.topics.find((t) => t.id === targetId);
    if (!targetId || !target) return;
    if (!window.confirm(strings.confirmMergeTopic(sourceName, target.name, countOf(sourceId)))) return;
    setBusy(true);
    try {
      const result = await adminApi.mergeTopic(game.id, sourceId, targetId);
      onChanged(strings.topicMerged(sourceName, target.name, result.moved, result.duplicatesDropped));
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (game.topics.length === 0) return <p>{strings.topicsEmpty}</p>;

  return (
    <ul className="topic-list">
      {game.topics.map((topic) => {
        const others = game.topics.filter((t) => t.id !== topic.id);
        const chosen = mergeInto[topic.id] ?? '';
        return (
          <li key={topic.id} className="topic-row">
            {/* A long name is cut with "…"; the full name shows when the pointer rests on it. */}
            <span className="topic-name" title={topic.name}>
              <span className="topic-title">{topic.name}</span> <span className="muted topic-count">({strings.connectionCount(countOf(topic.id))})</span>
            </span>
            <span className="topic-actions">
              {others.length > 0 && (
                <>
                  <select
                    className="topic-merge"
                    aria-label={`${strings.mergeInto} ${topic.name}`}
                    title={game.topics.find((t) => t.id === chosen)?.name}
                    value={chosen}
                    onChange={(e) => setMergeInto({ ...mergeInto, [topic.id]: e.target.value })}
                  >
                    <option value="">{strings.mergeInto}…</option>
                    {others.map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy || chosen === ''}
                    aria-label={`${strings.merge} ${topic.name}`}
                    onClick={() => void merge(topic.id, topic.name)}
                  >
                    {strings.merge}
                  </button>
                </>
              )}
              <button
                type="button"
                className="link-button"
                disabled={busy}
                aria-label={`${strings.deleteTopic} ${topic.name}`}
                onClick={() => void remove(topic.id, topic.name)}
              >
                {strings.deleteTopic}
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
