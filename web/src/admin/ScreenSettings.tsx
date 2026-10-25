import { DEFAULT_RULES, LIMITS, type GameDetails } from '@ctd/shared';
import { useState, type FormEvent } from 'react';
import { adminApi, ApiError } from '../api';
import { formatClock, useCountdown } from '../screen/useCountdown';
import { strings } from '../strings';
import { messageOf } from './format';

interface Props {
  game: GameDetails;
  receivedAt: number | undefined;
  onChanged: (notice: string) => void;
  onError: (message: string) => void;
}

/** Timer controls and the settings that shape the big-screen Timer screen. */
export function ScreenSettings({ game, receivedAt, onChanged, onError }: Props) {
  const [shortUrl, setShortUrl] = useState(game.settings.shortUrl);
  const [rulesText, setRulesText] = useState(game.settings.rulesText);
  const [minutes, setMinutes] = useState(String(game.settings.timerMinutes));
  const [showNames, setShowNames] = useState(game.settings.showNames);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shortUrlError, setShortUrlError] = useState('');
  const countdown = useCountdown(game.timer, receivedAt);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const patch: Parameters<typeof adminApi.updateGame>[1] = { shortUrl, rulesText, showNames };
      if (countdown.state === 'idle') patch.timerMinutes = Number(minutes);
      await adminApi.updateGame(game.id, patch);
      onChanged(strings.settingsSaved);
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  /** Asks our API for an is.gd link to this game's join page and puts it into the text box (it is saved with "Save settings"). */
  async function generateShortLink() {
    setGenerating(true);
    setShortUrlError('');
    try {
      const result = await adminApi.createShortLink(game.id);
      setShortUrl(result.shortUrl);
    } catch (e) {
      if (e instanceof ApiError && e.status === 502) setShortUrlError(strings.shortUrlUnavailable);
      else onError(messageOf(e));
    } finally {
      setGenerating(false);
    }
  }

  async function control(action: 'start' | 'pause' | 'reset') {
    setBusy(true);
    try {
      await adminApi.timer(game.id, action);
      onChanged(strings.timerUpdated);
    } catch (e) {
      onError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const stateText =
    countdown.state === 'running'
      ? countdown.timeUp
        ? strings.timeUp
        : strings.timerRunning
      : countdown.state === 'paused'
        ? strings.timerPaused
        : strings.timerNotStarted;

  return (
    <section>
      <h3>{strings.screenAndTimer}</h3>

      <div className="card card-column">
        <div className="timer-readout" role="timer" aria-live="off">
          <span className="clock-small">{formatClock(countdown.remainingSec)}</span>
          <span className="muted"> · {stateText}</span>
        </div>
        <div className="timer-buttons">
          {countdown.state !== 'running' && (
            <button type="button" className="button" disabled={busy} onClick={() => void control('start')}>
              {countdown.state === 'paused' ? strings.timerResume : strings.timerStart}
            </button>
          )}
          {countdown.state === 'running' && (
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => void control('pause')}>
              {strings.timerPause}
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || countdown.state === 'idle'}
            onClick={() => void control('reset')}
          >
            {strings.timerReset}
          </button>
          <a className="button" href={`/admin/games/${game.id}/screen`} target="_blank" rel="noreferrer">
            {strings.openTimerScreen}
          </a>
          <a className="button button-secondary" href={`/admin/games/${game.id}/results`} target="_blank" rel="noreferrer">
            {strings.openResults}
          </a>
        </div>
      </div>

      <form className="form" onSubmit={save}>
        <label htmlFor="timer-minutes">{strings.timerLength}</label>
        <input
          id="timer-minutes"
          type="number"
          min={LIMITS.minTimerMinutes}
          max={LIMITS.maxTimerMinutes}
          value={minutes}
          disabled={countdown.state !== 'idle'}
          onChange={(e) => setMinutes(e.target.value)}
        />

        <div className="field-title">
          <label htmlFor="short-url">{strings.shortUrlLabel}</label>{' '}
          <button type="button" className="link-button inline-link" disabled={busy || generating} onClick={() => void generateShortLink()}>
            {generating ? strings.shortUrlGenerating : strings.shortUrlGenerate}
          </button>
        </div>
        <input
          id="short-url"
          value={shortUrl}
          maxLength={LIMITS.maxShortUrlLength}
          placeholder="is.gd"
          aria-describedby="short-url-hint"
          onChange={(e) => setShortUrl(e.target.value)}
        />
        {shortUrlError ? (
          <span className="field-error" role="alert">
            {shortUrlError}
          </span>
        ) : (
          <span className="muted" id="short-url-hint">
            {strings.shortUrlHint}
          </span>
        )}

        <label htmlFor="rules">{strings.rulesLabel}</label>
        <textarea
          id="rules"
          rows={5}
          maxLength={LIMITS.maxRulesLength}
          value={rulesText}
          placeholder={DEFAULT_RULES.join('\n')}
          onChange={(e) => setRulesText(e.target.value)}
        />
        <span className="muted">{strings.rulesHint}</span>

        <label className="checkbox">
          <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
          {strings.showNamesOnScreen}
        </label>

        <button className="button" type="submit" disabled={busy}>
          {strings.saveSettings}
        </button>
      </form>
    </section>
  );
}
