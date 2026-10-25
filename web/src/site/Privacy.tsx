import { Fill, OperatorAddress, SiteLayout } from './Layout';
import { formatLongDate, SITE } from './siteConfig';

export function Privacy() {
  const { legal, limits } = SITE;
  return (
    <SiteLayout current="privacy">
      <div className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1>Privacy policy</h1>
          <p className="lead">
            What data {SITE.name} ("the service") processes, why, for how long, and what rights you have. Last updated {formatLongDate(legal.effectiveDate)}.
          </p>
        </div>
      </div>

      <div className="wrap prose">
        <nav className="toc" aria-label="On this page">
          <strong>On this page</strong>
          <ol>
            <li>
              <a href="#summary">The short version</a>
            </li>
            <li>
              <a href="#controller">Who is responsible</a>
            </li>
            <li>
              <a href="#data">What data we process</a>
            </li>
            <li>
              <a href="#purposes">Why we process it (legal bases)</a>
            </li>
            <li>
              <a href="#storage">Cookies and browser storage</a>
            </li>
            <li>
              <a href="#recipients">Who receives data</a>
            </li>
            <li>
              <a href="#transfers">Transfers outside Europe</a>
            </li>
            <li>
              <a href="#retention">How long we keep data</a>
            </li>
            <li>
              <a href="#security">How we protect data</a>
            </li>
            <li>
              <a href="#rights">Your rights</a>
            </li>
            <li>
              <a href="#children">Children</a>
            </li>
            <li>
              <a href="#changes">Changes to this policy</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ol>
        </nav>

        <h2 id="summary">The short version</h2>
        <ul>
          <li>Players do not create accounts. A game stores the names that the facilitator uploaded and the connections people add.</li>
          <li>Facilitators sign in with a Microsoft account. We keep only an opaque user ID that links your games to you.</li>
          <li>No advertising, no analytics, no tracking, no third-party scripts, no profiling and no selling of data.</li>
          <li>
            Games close automatically after a few days and are deleted {limits.retentionAfterExpiryDays} days after that. A facilitator can delete a game, with all
            its data, at any time.
          </li>
          <li>Data is stored with Microsoft Azure in the United States ({SITE.region}).</li>
          <li>The facilitator who runs a game decides which names go into it; for those names we act on the facilitator's behalf (see section 1).</li>
        </ul>

        <h2 id="controller">1. Who is responsible</h2>
        <p>
          The service is operated by <Fill value={legal.operatorName} label="operator name" /><OperatorAddress /> (
          "we", "us", "the operator"). You can reach us at <Fill value={legal.contactEmail} label="contact email" />.
        </p>
        <h3>Two roles, depending on the data</h3>
        <ul>
          <li>
            <strong>We are the controller</strong> for data about facilitators' sign-in (the user ID), for the technical data needed to keep the service secure
            (section 2, "Technical data"), and for messages you send us.
          </li>
          <li>
            <strong>The facilitator is the controller</strong> for the data of the participants of their game (names, connections, topics). We process that data
            only on the facilitator's behalf and instructions, as a <em>processor</em> (Article 28 GDPR), under the data processing terms in section 9 of the{' '}
            <a href="/terms#processing">terms of service</a>. Facilitators must have a lawful basis for the participant list and must inform participants.
          </li>
        </ul>

        <h2 id="data">2. What data we process</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Whose and where from</th>
                <th scope="col">Purpose</th>
                <th scope="col">Kept for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Facilitator user ID</th>
                <td>Facilitators. Provided by Microsoft sign-in (an opaque identifier, not your name or email address).</td>
                <td>Show you your games and keep other facilitators out of them.</td>
                <td>While you have games; removed with your last game</td>
              </tr>
              <tr>
                <th scope="row">Game details</th>
                <td>Facilitators: game name, join code, dates, optional short link, rules text, timer and display settings.</td>
                <td>Run the game.</td>
                <td>Until deleted by the facilitator or {limits.retentionAfterExpiryDays} days after the game expired</td>
              </tr>
              <tr>
                <th scope="row">Participant names</th>
                <td>Participants. Entered by the facilitator (list or text file).</td>
                <td>Let players choose their name and show the network.</td>
                <td>Same as the game</td>
              </tr>
              <tr>
                <th scope="row">Topics and connections</th>
                <td>Participants. Added by players: two names, a topic, who added it and when.</td>
                <td>Show each player their own connections and the facilitator the whole network and results.</td>
                <td>Same as the game; a deleted connection or topic is removed at once</td>
              </tr>
              <tr>
                <th scope="row">Technical data (client address)</th>
                <td>Everyone who enters a game code. Your network address reaches us with each request.</td>
                <td>
                  Slow down guessing of game codes. We store only a keyed hash of the address together with a failure counter, never the address itself.
                </td>
                <td>Replaced every 10 minutes and deleted within two days at the latest</td>
              </tr>
              <tr>
                <th scope="row">Hosting logs</th>
                <td>Everyone. Request details such as time, address and browser type are logged by the hosting platform (Microsoft Azure).</td>
                <td>Operating and securing the platform.</td>
                <td>As set by Microsoft; we do not add our own request logging</td>
              </tr>
              <tr>
                <th scope="row">Messages and issues</th>
                <td>Anybody who writes to us by email or opens a public issue on GitHub.</td>
                <td>Answer you, improve the service.</td>
                <td>Emails: as long as needed to answer, then deleted. Public issues: until removed</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We do <strong>not</strong> ask for special categories of data (for example health, religion or political views), and facilitators and players must not
          enter them. Names and topics are free text typed by people, so please keep them professional and general.
        </p>
        <p>
          The pictures you can export from the results pages are created in your own browser and are not sent to us.
        </p>

        <h2 id="purposes">3. Why we process it (legal bases)</h2>
        <ul>
          <li>
            <strong>Providing the service to facilitators</strong> (user ID, game details): Article 6(1)(b) GDPR, performance of the agreement formed by the{' '}
            <a href="/terms">terms of service</a>.
          </li>
          <li>
            <strong>Participant data</strong> (names, topics, connections): processed on the facilitator's behalf. The facilitator's own legal basis is usually
            legitimate interests (Article 6(1)(f), running a team activity) or, if they prefer, the participants' consent.
          </li>
          <li>
            <strong>Security and abuse prevention</strong> (hashed client address, hosting logs): our legitimate interest in keeping the service available and
            protecting games from being guessed or attacked, Article 6(1)(f).
          </li>
          <li>
            <strong>Answering messages</strong>: Article 6(1)(f), our legitimate interest in replying to you (or Article 6(1)(b) if you ask about the service you
            use).
          </li>
        </ul>
        <p>
          There is no automated decision-making or profiling that has legal or similarly significant effects on anyone. The "super-connector" and "top topic" views
          are simple counts shown to the facilitator.
        </p>

        <h2 id="storage">4. Cookies and browser storage</h2>
        <p>The service uses only what is strictly necessary to work. It does not need your consent under the ePrivacy rules and there is no cookie banner because there is nothing to choose.</p>
        <ul>
          <li>
            <strong>Players:</strong> your browser's local storage keeps a signed session token, the game name, the participant list and the name you picked, so you
            stay in the game if you reload the page. Tap "Leave game" or "Start over", or clear your browser data, to remove it. The token expires after 30 days
            at the latest and only works while the game is open.
          </li>
          <li>
            <strong>Facilitators:</strong> signing in sets the sign-in cookie of the Azure Static Web Apps platform so that you stay signed in.
          </li>
          <li>No advertising or analytics cookies, no fingerprinting, and no content loaded from other websites (fonts, scripts and images all come from this site).</li>
        </ul>

        <h2 id="recipients">5. Who receives data</h2>
        <ul>
          <li>
            <strong>Microsoft</strong> (Microsoft Corporation and its affiliates) provides hosting (Azure Static Web Apps, Azure Functions and Azure Table Storage)
            and the Microsoft sign-in for facilitators. Microsoft acts as our sub-processor for the data described above and under its own responsibility for the
            sign-in itself. See the <a href="https://www.microsoft.com/privacy/privacystatement" rel="noopener">Microsoft privacy statement</a>.
          </li>
          <li>
            <strong>GitHub</strong> hosts the source code and issues. The game data is never sent to GitHub. If you write an issue there, what you write is public.
          </li>
          <li>We do not sell personal data and do not share it with anyone else, except where the law requires it.</li>
        </ul>

        <h2 id="transfers">6. Transfers outside Europe</h2>
        <p>
          The data is stored in the Microsoft Azure region {SITE.region}. If you are in the European Economic Area, the United Kingdom or Switzerland, your data is
          therefore transferred to the United States. Microsoft participates in the EU-U.S. Data Privacy Framework (and its UK and Swiss extensions) and its
          data protection terms include the EU Standard Contractual Clauses, which are the safeguards on which this transfer relies. You can ask us for a
          copy of the relevant safeguards using the contact details in section 12.
        </p>

        <h2 id="retention">7. How long we keep data</h2>
        <ul>
          <li>
            <strong>Games and everything in them</strong> close automatically {limits.defaultExpiryDays} days after creation (the facilitator can extend this, up
            to {limits.maxExpiryDays} days ahead). Closed games are deleted automatically {limits.retentionAfterExpiryDays} days after they expired. The
            facilitator can delete a game immediately; deletion is permanent and there are no separate backups.
          </li>
          <li>
            <strong>Hashed client addresses</strong>: one row per 10-minute window; older rows are deleted at once and the rest within two days.
          </li>
          <li>
            <strong>Browser storage</strong>: until you remove it (see section 4).
          </li>
          <li>
            <strong>Emails</strong>: only as long as needed to answer you. <strong>GitHub issues</strong>: until removed; do not put personal data in them.
          </li>
        </ul>

        <h2 id="security">8. How we protect data</h2>
        <ul>
          <li>All traffic is encrypted (HTTPS) and the stored data is encrypted at rest by Microsoft.</li>
          <li>Browsers never access the database directly. Every request is checked on the server: facilitators can only reach their own games, players only their own game and connections.</li>
          <li>Game codes are 6 digits, wrong guesses are rate limited per (hashed) client, and player sessions are signed and tied to one game.</li>
          <li>Strict browser security headers (including a content security policy) and no third-party scripts.</li>
          <li>Secrets are kept in encrypted application settings, never in the code. The source code is open for review.</li>
          <li>Data minimisation: no player accounts, no passwords, no email addresses of players, and automatic deletion.</li>
        </ul>
        <p>
          Players join using a game code and select their name. The service does not independently verify player identities and is intended for informal
          activities among trusted participants.
        </p>
        <p>
          No system is perfectly secure. If a breach of personal data occurs that is likely to put people at risk, we will notify the supervisory authority and,
          where required, the people affected, and we will inform facilitators without undue delay.
        </p>

        <h2 id="rights">9. Your rights</h2>
        <p>Under the GDPR (and the UK GDPR) you have the right to:</p>
        <ul>
          <li>get information about, and a copy of, your personal data (<strong>right of access</strong>, Article 15);</li>
          <li>have wrong data corrected (<strong>right to rectification</strong>, Article 16);</li>
          <li>have your data deleted (<strong>right to erasure</strong>, Article 17);</li>
          <li>have the processing limited (<strong>right to restriction of processing</strong>, Article 18);</li>
          <li>receive your data in a common format (<strong>right to data portability</strong>, Article 20);</li>
          <li>object to processing that is based on legitimate interests (<strong>right to object</strong>, Article 21);</li>
          <li>
            complain to a data protection supervisory authority, for example in the country where you live or work. Our competent authority is{' '}
            <Fill value={legal.supervisoryAuthority} label="supervisory authority" />; a list of all authorities is kept by the{' '}
            <a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en" rel="noopener">
              European Data Protection Board
            </a>
            .
          </li>
        </ul>
        <p>
          <strong>If you are a participant</strong> (your name is on a game's list), the facilitator of that game is responsible for your data, so please ask them
          first. They can correct or remove your name and connections. You can also write to us and we will help the facilitator to answer you, or act directly if
          we are the controller. <strong>If you are a facilitator</strong>, you can delete your games yourself at any time.
        </p>
        <p>
          To use a right, email <Fill value={legal.contactEmail} label="contact email" />, not a public issue. We may ask you to prove who you are. We answer within one
          month. Withdrawing consent, where it applies, never affects what happened before.
        </p>

        <h2 id="children">10. Children</h2>
        <p>The service is meant for adults in professional team activities. It is not directed at children under 16 and facilitators must not run games with them.</p>

        <h2 id="changes">11. Changes to this policy</h2>
        <p>
          We may update this policy, for example when the service changes. The date at the top shows the latest version. We will point out important changes on the
          start page.
        </p>

        <h2 id="contact">12. Contact</h2>
        <p>
          <Fill value={legal.operatorName} label="operator name" /><OperatorAddress />,{' '}
          <Fill value={legal.contactEmail} label="contact email" />.
        </p>
        <h2 id="contact-more">13. Where to send privacy requests</h2>
        <p>
          Send privacy requests and security reports by email to the address above. Please do not use public GitHub issues for them: issues are visible to everyone.
        </p>
      </div>
    </SiteLayout>
  );
}
