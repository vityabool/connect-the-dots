import { Link, useParams } from 'react-router-dom';
import { strings } from '../strings';
import { JoinForm } from './JoinForm';

/** Opened from a join link or QR code (/join/123456): the code is already filled in. */
export function JoinPage() {
  const params = useParams();

  return (
    <main className="home">
      <h1>{strings.appTitle}</h1>
      <h2>{strings.appSubtitle}</h2>
      <JoinForm initialCode={params.code} className="form join-form" />
      <p className="muted">
        <Link to="/admin">{strings.facilitatorLink}</Link>
      </p>
    </main>
  );
}
