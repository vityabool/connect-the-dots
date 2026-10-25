import { LIMITS, type MyConnection, type PlayState } from '@ctd/shared';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, playApi } from '../api';
import { useLive } from '../live';
import { messageOf } from '../admin/format';
import { strings } from '../strings';
import { clearSession, loadSession, saveSession, type Session } from './session';

export function PlayPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | undefined>(() => loadSession());

  function leave() {
    clearSession();
    navigate('/');
  }

  if (!session) return <Navigate to="/" replace />;

  if (!session.me) {
    return (
      <ChooseName
        session={session}
        onChosen={(next) => {
          saveSession(next);
          setSession(next);
        }}
        onLeave={leave}
      />
    );
  }

  return <Connections session={session} onLeave={leave} />;
}

function ChooseName(props: { session: Session; onChosen: (session: Session) => void; onLeave: () => void }) {
  const { session } = props;
  const [participantId, setParticipantId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const chosen = session.participants.find((p) => p.id === participantId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await playApi.pickIdentity(session.token, chosen.id);
      props.onChosen({ ...session, token: result.token, me: result.me });
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <h1>{session.gameName}</h1>
      <h2>{strings.chooseNameTitle}</h2>
      <form className="form" onSubmit={submit}>
        <p>{strings.chooseNameHint}</p>
        <label htmlFor="who">{strings.chooseNameLabel}</label>
        <select id="who" value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
          <option value="">{strings.chooseNamePlaceholder}</option>
          {session.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button" type="submit" disabled={busy || !chosen}>
          {chosen ? strings.continueAs(chosen.name) : strings.joinButton}
        </button>
      </form>
      <p>
        <button type="button" className="link-button muted" onClick={props.onLeave}>
          {strings.notYou}
        </button>
      </p>
    </main>
  );
}

const NEW_TOPIC = '__new__';

function Connections(props: { session: Session; onLeave: () => void }) {
  const { session } = props;
  const [ended, setEnded] = useState(false);

  const live = useLive<PlayState>({
    key: session.token,
    fetch: (since) => playApi.state(session.token, since),
    versionOf: (s) => s.game.version,
    isFatal: (e) => e instanceof ApiError && (e.status === 401 || e.status === 410),
    onFatal: (e) => {
      if (e instanceof ApiError && e.status === 410) setEnded(true);
      else props.onLeave();
    },
  });
  const state = live.data;
  const reload = live.refresh;

  if (ended) {
    return (
      <main className="home">
        <h1>{session.gameName}</h1>
        <p>{strings.gameEnded}</p>
        <button type="button" className="button" onClick={props.onLeave}>
          {strings.leaveGame}
        </button>
      </main>
    );
  }

  return (
    <main className="page">
      <header>
        <h1>{session.gameName}</h1>
        <p className="muted">{strings.hello(session.me?.name ?? '')}</p>
      </header>
      {live.offline && (
        <p className="warning" role="status">
          {strings.reconnecting}
        </p>
      )}
      {!state && !live.offline && <p role="status">{strings.adminLoading}</p>}
      {state && (
        <>
          <AddConnection session={session} state={state} onSaved={reload} />
          <MyConnections session={session} connections={state.connections} onChanged={reload} />
        </>
      )}
      <p>
        <button type="button" className="link-button muted" onClick={props.onLeave}>
          {strings.leaveGame}
        </button>
      </p>
    </main>
  );
}

function AddConnection(props: { session: Session; state: PlayState; onSaved: () => void }) {
  const { session, state } = props;
  const [otherId, setOtherId] = useState('');
  const [topicChoice, setTopicChoice] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const others = state.participants.filter((p) => p.id !== state.me.id);
  // Keep the new-topic box open while something is typed, even if other players add topics meanwhile.
  const creatingTopic =
    topicChoice === NEW_TOPIC || state.topics.length === 0 || (topicChoice === '' && newTopic.trim() !== '');
  const ready = otherId !== '' && (creatingTopic ? newTopic.trim() !== '' : topicChoice !== '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const created = await playApi.addConnection(
        session.token,
        creatingTopic ? { otherId, newTopicName: newTopic } : { otherId, topicId: topicChoice },
      );
      setNotice(strings.connectedWith(created.otherName, created.topicName));
      setOtherId('');
      setTopicChoice('');
      setNewTopic('');
      props.onSaved();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form card card-column" onSubmit={submit}>
      <h2>{strings.addConnectionTitle}</h2>
      <p className="muted">{strings.playIntro}</p>

      <label htmlFor="other">{strings.withWhom}</label>
      <select id="other" value={otherId} onChange={(e) => setOtherId(e.target.value)}>
        <option value="">{strings.withWhomPlaceholder}</option>
        {others.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {state.topics.length > 0 && (
        <>
          <label htmlFor="topic">{strings.topicLabel}</label>
          <select id="topic" value={topicChoice} onChange={(e) => setTopicChoice(e.target.value)}>
            <option value="">{strings.topicPlaceholder}</option>
            {state.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={NEW_TOPIC}>{strings.newTopicOption}</option>
          </select>
        </>
      )}
      {creatingTopic && (
        <>
          <label htmlFor="new-topic">{strings.newTopicLabel}</label>
          <input
            id="new-topic"
            value={newTopic}
            maxLength={LIMITS.maxTopicNameLength}
            placeholder={strings.newTopicPlaceholder}
            onChange={(e) => setNewTopic(e.target.value)}
          />
        </>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <button className="button" type="submit" disabled={busy || !ready}>
        {busy ? strings.savingConnection : strings.addConnectionButton}
      </button>
    </form>
  );
}

function MyConnections(props: { session: Session; connections: MyConnection[]; onChanged: () => void }) {
  const [confirming, setConfirming] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function remove(id: string) {
    setBusy(true);
    setError(undefined);
    try {
      await playApi.deleteConnection(props.session.token, id);
      setConfirming(undefined);
      props.onChanged();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>{strings.myConnections(props.connections.length)}</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {props.connections.length === 0 ? (
        <p>{strings.noConnections}</p>
      ) : (
        <ul className="cards">
          {props.connections.map((c) => (
            <li key={c.id} className="card">
              <div>
                <strong>{c.otherName}</strong>
                <div>{c.topicName}</div>
                <div className="muted">{c.createdByMe ? strings.youAdded : strings.addedYou}</div>
              </div>
              {confirming === c.id ? (
                <div className="confirm" role="group" aria-label={strings.confirmDeleteConnection}>
                  <p>{strings.confirmDeleteConnection}</p>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={busy}
                    onClick={() => void remove(c.id)}
                  >
                    {strings.yesDelete}
                  </button>{' '}
                  <button type="button" className="button button-secondary" onClick={() => setConfirming(undefined)}>
                    {strings.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="link-button"
                  aria-label={`${strings.deleteConnection} ${c.otherName} ${c.topicName}`}
                  onClick={() => setConfirming(c.id)}
                >
                  {strings.deleteConnection}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
