import { DEFAULT_RULES, networkCounts } from '@ctd/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { graphData, useGame } from '../admin/gameData';
import { NetworkGraph } from '../graph/NetworkGraph';
import { makeTopicColors } from '../graph/palette';
import { strings } from '../strings';
import { QrCode } from './QrCode';
import { formatClock, useCountdown } from './useCountdown';

/** Three short beeps; browsers only allow sound after the facilitator clicked something on the page. */
function beep() {
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    for (let i = 0; i < 3; i += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.2;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + i * 0.5);
      oscillator.stop(context.currentTime + i * 0.5 + 0.3);
    }
  } catch {
    // no audio available; the visual notification is enough
  }
}

/** The big-screen view shown while people walk around and make connections. */
export function TimerScreen() {
  const { gameId = '' } = useParams();
  const [error, setError] = useState<string | undefined>();
  const [sound, setSound] = useState(false);
  const live = useGame(gameId, setError);
  const game = live.data;
  const countdown = useCountdown(game?.timer, live.receivedAt);

  const { timeUp } = countdown;
  useEffect(() => {
    if (timeUp && sound) beep();
  }, [timeUp, sound]);

  const data = useMemo(() => (game ? graphData(game) : undefined), [game]);
  const topicColor = useMemo(() => makeTopicColors(game?.topics ?? []), [game?.topics]);
  const counts = useMemo(() => (data ? networkCounts(data.people, data.statEdges) : undefined), [data]);

  if (error) {
    return (
      <main className="screen">
        <p className="error" role="alert">
          {error}
        </p>
      </main>
    );
  }
  if (!game || !data || !counts) {
    return (
      <main className="screen">
        <p role="status">{strings.adminLoading}</p>
      </main>
    );
  }

  const rules = game.settings.rulesText
    ? game.settings.rulesText.split(/\r?\n/).filter((line) => line.trim() !== '')
    : [...DEFAULT_RULES];
  const joinUrl = `${window.location.origin}/join/${game.code}`;
  const where = game.settings.shortUrl || window.location.host;

  return (
    <main className="screen">
      <header className="screen-head">
        <h1>{game.name}</h1>
        <span className="screen-tools">
          <button type="button" className="link-button" onClick={() => setSound(!sound)} aria-pressed={sound}>
            {sound ? strings.soundOn : strings.soundOff}
          </button>
          <button type="button" className="link-button" onClick={() => void document.documentElement.requestFullscreen?.()}>
            {strings.fullscreen}
          </button>
          <Link to={`/admin/games/${gameId}`}>{strings.backToGame}</Link>
        </span>
      </header>

      {live.offline && (
        <p className="warning" role="status">
          {strings.reconnecting}
        </p>
      )}

      <div className="screen-grid">
        <section className="screen-left">
          <div className={`clock${timeUp ? ' clock-up' : ''}`} role="timer" aria-live="off">
            {formatClock(countdown.remainingSec)}
          </div>
          <div className="clock-state">
            {countdown.state === 'idle' && strings.timerNotStarted}
            {countdown.state === 'paused' && strings.timerPaused}
            {countdown.state === 'running' && !timeUp && strings.timerRunning}
            {timeUp && <strong role="alert">{strings.timeUp}</strong>}
          </div>
          {timeUp && <p className="time-up-note">{strings.timeUpNote}</p>}

          <div className="join-box">
            <div>
              <div className="muted">{strings.joinAt}</div>
              <div className="join-url">{where}</div>
              <div className="muted">{strings.enterCode}</div>
              <div className="join-code">{game.code}</div>
            </div>
            <QrCode value={joinUrl} label={strings.qrLabel} />
          </div>

          <h2>{strings.howToPlay}</h2>
          <ol className="rules">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </section>

        <section className="screen-right">
          <NetworkGraph
            nodes={data.nodes}
            edges={data.edges}
            showNames={game.settings.showNames}
            topicColor={topicColor}
            highlightIsolated
            label={strings.graphLabel}
          />
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
          {counts.allConnected && <p className="celebrate">{strings.everyoneConnected}</p>}
        </section>
      </div>
    </main>
  );
}
