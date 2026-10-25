import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageOf } from '../admin/format';
import { playApi } from '../api';
import { strings } from '../strings';
import { saveSession } from './session';

/** The "enter your 6-digit game code" form, used on the start page and on /join/<code>. */
export function JoinForm(props: { initialCode?: string; className?: string; hint?: boolean }) {
  const navigate = useNavigate();
  const [code, setCode] = useState((props.initialCode ?? '').replace(/\D/g, '').slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function join(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const result = await playApi.join(code);
      saveSession({ token: result.token, gameName: result.game.name, participants: result.participants });
      navigate('/play');
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <form className={props.className ?? 'form join-form'} onSubmit={join}>
      {props.hint !== false && <p>{strings.joinHint}</p>}
      <label htmlFor="code">{strings.joinCodeLabel}</label>
      <input
        id="code"
        className="code-input"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={busy || code.length !== 6}>
        {busy ? strings.joining : strings.joinButton}
      </button>
    </form>
  );
}
