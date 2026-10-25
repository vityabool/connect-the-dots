import type { GameSummary } from '@ctd/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import { strings } from '../strings';
import { formatDateTime, messageOf } from './format';

export function GamesList() {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[] | undefined>();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listGames()
      .then((list) => {
        if (!cancelled) setGames(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(messageOf(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const game = await adminApi.createGame(name);
      navigate(`/admin/games/${game.id}`);
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {games === undefined && !error && <p role="status">{strings.adminLoading}</p>}
      {games?.length === 0 && <p>{strings.gamesNone}</p>}
      {games && games.length > 0 && (
        <ul className="cards">
          {games.map((game) => (
            <li key={game.id} className="card">
              <div>
                <strong>{game.name}</strong>
                <div className="muted">
                  {strings.gameCode}: <span className="code">{game.code}</span> ·{' '}
                  {game.expired ? (
                    <span className="badge badge-expired">{strings.gameExpired}</span>
                  ) : (
                    <>
                      {strings.gameExpires} {formatDateTime(game.expiresAt)}
                    </>
                  )}
                </div>
              </div>
              <Link className="button" to={`/admin/games/${game.id}`}>
                {strings.openGame}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form className="form" onSubmit={create}>
        <label htmlFor="game-name">{strings.gameNameLabel}</label>
        <input
          id="game-name"
          value={name}
          maxLength={80}
          placeholder={strings.gameNamePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="button" type="submit" disabled={busy || name.trim() === ''}>
          {busy ? strings.creating : strings.createGame}
        </button>
      </form>
    </>
  );
}
