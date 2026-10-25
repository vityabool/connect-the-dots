import { SiteLayout } from './Layout';

/** Shown for addresses that do not exist (the app shell is served for every unknown address). */
export function NotFound() {
  return (
    <SiteLayout current="home">
      <div className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Error 404</p>
          <h1>This page does not exist</h1>
          <p className="lead">The address may be wrong, or the page has moved.</p>
          <p>
            <a className="btn" href="/">
              Go to the start page
            </a>
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
