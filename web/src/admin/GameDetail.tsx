import { DEFAULT_TOPICS, LIMITS } from '@ctd/shared';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../api';
import { strings } from '../strings';
import { ConnectionsManager } from './ConnectionsManager';
import { formatDateTime, messageOf } from './format';
import { useGame } from './gameData';
import { ScreenSettings } from './ScreenSettings';
import { TopicsManager } from './TopicsManager';

const DAY_MS = 24 * 60 * 60 * 1000;

export function GameDetail() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [names, setNames] = useState('');
  const [topicNames, setTopicNames] = useState('');
  const [busy, setBusy] = useState(false);

  // Participants, topics and connections keep updating while the game is played.
  const live = useGame(gameId, setError);
  const game = live.data;
  const load = async () => live.refresh();
  const afterChange = (message: string) => {
    setError(undefined);
    setNotice(message);
    live.refresh();
  };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function addNames(text: string) {
    await run(async () => {
      const result = await adminApi.addParticipants(gameId, text);
      setNotice(strings.addedSummary(result.added.length, result.duplicatesSkipped, result.tooLongSkipped));
      setNames('');
      await load();
    });
  }

  function onSubmitNames(event: FormEvent) {
    event.preventDefault();
    void addNames(names);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    // Text that is not UTF-8 (for example Windows-1251 or UTF-16) decodes to replacement or NUL characters.
    if (text.includes(String.fromCharCode(0xfffd)) || text.includes(String.fromCharCode(0))) {
      setNotice(undefined);
      setError(strings.notUtf8);
      return;
    }
    await addNames(text);
  }

  async function addTopicList(text: string) {
    await run(async () => {
      const result = await adminApi.addTopics(gameId, text);
      setNotice(strings.addedTopicsSummary(result.added.length, result.duplicatesSkipped, result.shortened));
      setTopicNames('');
      await load();
    });
  }

  function onSubmitTopics(event: FormEvent) {
    event.preventDefault();
    void addTopicList(topicNames);
  }

  async function extend() {
    if (!game) return;
    await run(async () => {
      const now = Date.now();
      const base = Math.max(now, Date.parse(game.expiresAt));
      const target = Math.min(base + 3 * DAY_MS, now + LIMITS.maxExpiryDays * DAY_MS - 60_000);
      await adminApi.updateGame(gameId, { expiresAt: new Date(target).toISOString() });
      await load();
    });
  }

  async function removeParticipant(id: string, name: string) {
    if (!window.confirm(strings.confirmRemoveParticipant(name))) return;
    await run(async () => {
      await adminApi.deleteParticipant(gameId, id);
      await load();
    });
  }

  async function removeGame() {
    if (!game || !window.confirm(strings.confirmDeleteGame(game.name))) return;
    await run(async () => {
      await adminApi.deleteGame(gameId);
      navigate('/admin');
    });
  }

  return (
    <>
      <p>
        <Link to="/admin">{strings.backToGames}</Link>
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {live.offline && (
        <p className="warning" role="status">
          {strings.reconnecting}
        </p>
      )}
      {!game && !error && !live.offline && <p role="status">{strings.adminLoading}</p>}
      {game && (
        <>
          <h2>{game.name}</h2>
          <section className="card card-column">
            <div>
              {strings.gameCode}: <span className="code code-big">{game.code}</span>
              <div className="muted">{strings.joinWithCode}</div>
            </div>
            <div>
              {game.expired ? (
                <span className="badge badge-expired">{strings.gameExpired}</span>
              ) : (
                <>
                  {strings.gameExpires} {formatDateTime(game.expiresAt)}
                </>
              )}{' '}
              <button type="button" className="button button-secondary" onClick={extend} disabled={busy}>
                {strings.extendExpiry}
              </button>
            </div>
          </section>

          <h3>
            {strings.participants} ({game.participants.length})
          </h3>
          {notice && <p className="notice" role="status">{notice}</p>}
          {game.participants.length === 0 ? (
            <p>{strings.participantsEmpty}</p>
          ) : (
            <ul className="people">
              {game.participants.map((person) => (
                <li key={person.id}>
                  <span>{person.name}</span>
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`${strings.removeParticipant} ${person.name}`}
                    onClick={() => void removeParticipant(person.id, person.name)}
                    disabled={busy}
                  >
                    {strings.removeParticipant}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="form" onSubmit={onSubmitNames}>
            <label htmlFor="upload">{strings.uploadTxt}</label>
            <input id="upload" type="file" accept=".txt,text/plain" onChange={(e) => void onFile(e)} disabled={busy} />
            <label htmlFor="names">{strings.pasteNamesLabel}</label>
            <textarea id="names" rows={5} value={names} onChange={(e) => setNames(e.target.value)} />
            <button className="button" type="submit" disabled={busy || names.trim() === ''}>
              {busy ? strings.adding : strings.addNames}
            </button>
          </form>

          <h3>
            {strings.topics} ({game.topics.length})
          </h3>
          <TopicsManager game={game} onChanged={afterChange} onError={setError} />
          <form className="form" onSubmit={onSubmitTopics}>
            <label htmlFor="topics">{strings.addTopicsLabel}</label>
            <textarea id="topics" rows={4} value={topicNames} onChange={(e) => setTopicNames(e.target.value)} />
            <div>
              <button className="button" type="submit" disabled={busy || topicNames.trim() === ''}>
                {strings.addTopicsButton}
              </button>{' '}
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => void addTopicList(DEFAULT_TOPICS.join('\n'))}
              >
                {strings.restoreDefaultTopics}
              </button>
            </div>
          </form>

          <ScreenSettings game={game} receivedAt={live.receivedAt} onChanged={afterChange} onError={setError} />

          <ConnectionsManager game={game} onChanged={afterChange} onError={setError} />

          <p>
            <button type="button" className="button button-danger" onClick={() => void removeGame()} disabled={busy}>
              {strings.deleteGame}
            </button>
          </p>
        </>
      )}
    </>
  );
}
