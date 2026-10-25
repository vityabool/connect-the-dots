import { useEffect, useState } from 'react';
import { Link, Outlet, Route, Routes } from 'react-router-dom';
import { adminApi, type Admin } from './api';
import { GameDetail } from './admin/GameDetail';
import { GamesList } from './admin/GamesList';
import { ResultsPage } from './results/ResultsPage';
import { TimerScreen } from './screen/TimerScreen';
import { strings } from './strings';

type State = { kind: 'loading' } | { kind: 'signedOut' } | { kind: 'signedIn'; admin: Admin };

export function AdminPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    adminApi
      .me()
      .then((admin): State => ({ kind: 'signedIn', admin }))
      .catch((): State => ({ kind: 'signedOut' }))
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <main className="page">
        <p role="status">{strings.adminLoading}</p>
      </main>
    );
  }

  if (state.kind === 'signedOut') {
    return (
      <main className="home">
        <h1>{strings.adminTitle}</h1>
        <p>{strings.adminSignInHint}</p>
        <p>
          <a className="button" href="/.auth/login/aad?post_login_redirect_uri=/admin">
            {strings.adminSignIn}
          </a>
        </p>
        <p>
          <Link to="/">{strings.backHome}</Link>
        </p>
      </main>
    );
  }

  const { admin } = state;
  return (
    <Routes>
      <Route path="games/:gameId/screen" element={<TimerScreen />} />
      <Route path="games/:gameId/results" element={<ResultsPage />} />
      <Route element={<AdminChrome name={admin.displayName} />}>
        <Route index element={<GamesList />} />
        <Route path="games/:gameId" element={<GameDetail />} />
      </Route>
    </Routes>
  );
}

/** The admin pages' frame: title bar with the signed-in user and sign-out. */
function AdminChrome(props: { name: string }) {
  return (
    <main className="page">
      <header className="topbar">
        <h1>{strings.adminTitle}</h1>
        <span className="muted">
          {strings.adminSignedInAs} <strong>{props.name}</strong> ·{' '}
          <a href="/.auth/logout?post_logout_redirect_uri=/">{strings.adminSignOut}</a>
        </span>
      </header>
      <Outlet />
    </main>
  );
}
