import type { ReactNode } from 'react';
import { formatLongDate, issuesUrl, SITE } from './siteConfig';

/** The logo: three dots joined by lines (also used, in a larger version, on the landing page). */
export function Logo(props: { size?: number }) {
  const size = props.size ?? 28;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#0f172a" stroke="#243352" />
      <path d="M9 22 16 10l7 12" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22h14" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="22" r="3.5" fill="#f8fafc" />
      <circle cx="16" cy="10" r="3.5" fill="#f8fafc" />
      <circle cx="23" cy="22" r="3.5" fill="#f8fafc" />
    </svg>
  );
}

/** Marks a detail the operator still has to fill in (see legal.config.json). */
export function Fill(props: { value: string; label: string }) {
  const value = props.value.trim();
  if (value) return <>{value}</>;
  return <mark className="todo">[{props.label}: to be completed by the operator]</mark>;
}

/** The operator's postal address, with a leading comma. It is optional: the contact email is enough under the GDPR. */
export function OperatorAddress() {
  const address = SITE.legal.operatorAddress.trim();
  return address ? <>, {address}</> : null;
}

/** A link to the source code, or a plain note while the repository is still private. */
export function SourceLink(props: { children?: ReactNode }) {
  if (SITE.repo.public) {
    return (
      <a href={SITE.repo.url} rel="noopener">
        {props.children ?? 'Source code on GitHub'}
      </a>
    );
  }
  return <span>Open source, repository coming soon</span>;
}

export function IssuesLink(props: { children?: ReactNode }) {
  if (SITE.repo.public) {
    return (
      <a href={issuesUrl('new')} rel="noopener">
        {props.children ?? 'Open an issue on GitHub'}
      </a>
    );
  }
  return <span>{props.children ?? 'GitHub issues (available when the repository is public)'}</span>;
}

type NavKey = 'home' | 'how-to-play' | 'privacy' | 'terms';

/** Page frame shared by the landing page, the how-to-play page and the legal pages. */
export function SiteLayout(props: { current: NavKey; children: ReactNode }) {
  return (
    <div className="site">
      <a className="skip-link" href="#content">
        Skip to the content
      </a>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="/">
            <Logo />
            <span>{SITE.name}</span>
          </a>
          <nav className="nav" aria-label="Main">
            <a href="/how-to-play" aria-current={props.current === 'how-to-play' ? 'page' : undefined}>
              How to play
            </a>
            <a className="nav-hide-mobile" href="/#facilitators">
              For facilitators
            </a>
            <a className="nav-hide-mobile" href="/#open-source">
              Open source
            </a>
            <a className="nav-cta" href="/#join">
              Join a game
            </a>
          </nav>
        </div>
      </header>

      <main id="content">{props.children}</main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <a className="brand" href="/">
                <Logo />
                <span>
                  {SITE.name}: {SITE.subtitle}
                </span>
              </a>
              <p>{SITE.description}</p>
            </div>
            <div>
              <h2>Play</h2>
              <ul>
                <li>
                  <a href="/#join">Join a game</a>
                </li>
                <li>
                  <a href="/how-to-play">How to play</a>
                </li>
                <li>
                  <a href="/#facilitators">Run a game (facilitators)</a>
                </li>
              </ul>
            </div>
            <div>
              <h2>Legal and open source</h2>
              <ul>
                <li>
                  <a href="/privacy" aria-current={props.current === 'privacy' ? 'page' : undefined}>
                    Privacy policy
                  </a>
                </li>
                <li>
                  <a href="/terms" aria-current={props.current === 'terms' ? 'page' : undefined}>
                    Terms of service
                  </a>
                </li>
                <li>
                  <SourceLink />
                </li>
                <li>
                  <IssuesLink>Report a problem or suggest an idea</IssuesLink>
                </li>
              </ul>
            </div>
          </div>
          <p className="legal-line">
            Free to use as is, without support or warranty. No advertising, no tracking, no cookies beyond what the game
            needs. Open source under the {SITE.license.name}. Legal texts last updated {formatLongDate(SITE.legal.effectiveDate)}.
          </p>
        </div>
      </footer>
    </div>
  );
}
