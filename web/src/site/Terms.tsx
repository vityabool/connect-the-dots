import { Fill, OperatorAddress, IssuesLink, SiteLayout, SourceLink } from './Layout';
import { formatLongDate, SITE } from './siteConfig';

export function Terms() {
  const { legal, limits } = SITE;
  return (
    <SiteLayout current="terms">
      <div className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1>Terms of service</h1>
          <p className="lead">
            The rules for using {SITE.name} ("the service"), including what you can and cannot expect from it. Last updated{' '}
            {formatLongDate(legal.effectiveDate)}.
          </p>
        </div>
      </div>

      <div className="wrap prose">
        <div className="notice-box" role="note">
          <p>
            <strong>In short:</strong> the service is free and is provided <strong>as is, without support and without warranty</strong>. It can change or stop at any
            time. Use it only for friendly, lawful team activities, and do not rely on it for anything critical.
          </p>
        </div>

        <nav className="toc" aria-label="On this page">
          <strong>On this page</strong>
          <ol>
            <li>
              <a href="#who">Who we are</a>
            </li>
            <li>
              <a href="#users">Who may use the service</a>
            </li>
            <li>
              <a href="#as-is">Provided as is: no support, no warranty</a>
            </li>
            <li>
              <a href="#accounts">Facilitator accounts</a>
            </li>
            <li>
              <a href="#facilitators">Facilitator responsibilities</a>
            </li>
            <li>
              <a href="#use">Acceptable use</a>
            </li>
            <li>
              <a href="#content">Content and intellectual property</a>
            </li>
            <li>
              <a href="#open-source">Open source and feedback</a>
            </li>
            <li>
              <a href="#processing">Data processing terms</a>
            </li>
            <li>
              <a href="#availability">Availability, changes and termination</a>
            </li>
            <li>
              <a href="#liability">Liability</a>
            </li>
            <li>
              <a href="#changes">Changes to these terms</a>
            </li>
            <li>
              <a href="#law">Governing law</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ol>
        </nav>

        <h2 id="who">1. Who we are</h2>
        <p>
          The service is operated by <Fill value={legal.operatorName} label="operator name" /><OperatorAddress /> ("we", "us").
          By using the service you agree to these terms. If you do not agree, please do not use it. How we handle personal data is described in the{' '}
          <a href="/privacy">privacy policy</a>.
        </p>

        <h2 id="users">2. Who may use the service</h2>
        <ul>
          <li>
            <strong>Players</strong> take part in a game run by a facilitator. You need the game code and the name the facilitator put on the list.
          </li>
          <li>
            <strong>Facilitators</strong> sign in with a Microsoft account and create and run games. You must be old enough to enter into a contract where you
            live, and in any case at least 16 years old. If you use the service for an employer or another organisation, you confirm that you may do so for it.
          </li>
          <li>The service is meant for professional team activities with adults. Do not run games with children.</li>
        </ul>

        <h2 id="as-is">3. Provided as is: no support, no warranty</h2>
        <ul>
          <li>The service is free of charge and is provided <strong>"as is" and "as available"</strong>.</li>
          <li>
            <strong>No warranty.</strong> We make no promises about availability, accuracy, fitness for a particular purpose or that it is free of errors, and we
            give no service level.
          </li>
          <li>
            <strong>No support.</strong> We do not promise to answer questions, fix problems or make changes. You are welcome to report problems and suggest ideas
            (see section 8), but there is no right to a reply or to a deadline.
          </li>
          <li>
            <strong>No guarantee that data is kept.</strong> Games close after their expiry date and are deleted automatically {limits.retentionAfterExpiryDays} days
            later, and the service could lose data. Export the results you want to keep (as images) and do not store anything here that you cannot afford to lose.
          </li>
          <li>Some countries give consumers rights that cannot be excluded. Nothing in these terms limits such rights.</li>
        </ul>

        <h2 id="accounts">4. Facilitator accounts</h2>
        <p>
          Facilitators sign in with a personal or work Microsoft account. We do not see your password. You are responsible for what happens under your sign-in, so keep
          your Microsoft account secure. Each facilitator can only see and change the games they created. You can stop using the service at any time by deleting
          your games.
        </p>

        <h2 id="facilitators">5. Facilitator responsibilities</h2>
        <p>When you run a game you decide whose names are put into it. You therefore agree that:</p>
        <ul>
          <li>you are allowed to use these names for a team activity and have a valid legal basis under data protection law (for example legitimate interests, or consent);</li>
          <li>you will tell participants that their names and connections are processed by the service and point them to the <a href="/privacy">privacy policy</a>;</li>
          <li>you will not enter special categories of personal data (health, religion, political opinions and similar), data of children, or secrets of any kind;</li>
          <li>you will respond to questions and requests from participants about their data in your game, and delete data when it is no longer needed;</li>
          <li>you stay within the limits: up to {limits.participants} participants, {limits.topics} topics and {limits.gamesPerFacilitator} games per facilitator.</li>
        </ul>

        <h2 id="use">6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>enter or post anything unlawful, offensive, discriminatory, harassing or misleading, or anything that violates other people's rights;</li>
          <li>use the service to collect data about people for other purposes, to monitor or evaluate them, or to profile them;</li>
          <li>try to access games, accounts or data that are not yours, guess game codes, or work around the limits or security of the service;</li>
          <li>send automated or excessive requests, scrape the service, or do anything that could overload, damage or disrupt it (load testing needs our written permission);</li>
          <li>reverse engineer or attack the hosted service. Reviewing and running the open-source code on your own systems is welcome (section 8).</li>
        </ul>
        <p>We may remove content, close games or block access if these rules are broken or to protect the service, without notice where necessary.</p>

        <h2 id="content">7. Content and intellectual property</h2>
        <p>
          Names, topics and other content you enter remain yours (or your organisation's). You give us only the permission needed to store, display and process it to
          run the service for you, as described in these terms and the privacy policy. The name, logo and design of the service are ours, except for the software
          itself, which is available under the licence described in section 8.
        </p>

        <h2 id="open-source">8. Open source and feedback</h2>
        <ul>
          <li>
            The <strong>software</strong> is open source under the <a href={SITE.license.url} rel="noopener">{SITE.license.name}</a>. That licence, not these terms,
            governs what you may do with the code. It includes its own disclaimer of warranty. The licence covers the code only: it gives no right to use, access
            or copy the data stored in the hosted service. <SourceLink />.
          </li>
          <li>
            <strong>Feedback</strong> (bug reports, ideas, complaints) is welcome as a GitHub issue: <IssuesLink>open an issue</IssuesLink>. Issues are public, so do not
            include personal data or security vulnerabilities. For security problems and privacy requests, write to us by email (see section 14).
          </li>
          <li>If you contribute code or text, you agree that it is released under the same licence as the project.</li>
        </ul>

        <h2 id="processing">9. Data processing terms</h2>
        <p>
          If you are a facilitator, you are the controller of the personal data of the participants in your games and we are your processor (Article 28 GDPR). This
          section is the data processing agreement between you and us.
        </p>
        <ol>
          <li>
            <strong>Subject matter and duration.</strong> Storing and displaying the participant names, topics and connections of your games so that you can run them.
            It lasts until the game is deleted (by you, or automatically {limits.retentionAfterExpiryDays} days after it expired).
          </li>
          <li>
            <strong>Types of data and people.</strong> Names, topics and connections (who connected with whom, on what topic, when) of the people on your participant list,
            typically employees or team members.
          </li>
          <li>
            <strong>Instructions.</strong> We process this data only to provide the service and on your documented instructions, which are your use of the features of the
            service. We will tell you if we think an instruction breaks data protection law.
          </li>
          <li>
            <strong>Confidentiality.</strong> People who have access to the data on our side are bound to confidentiality.
          </li>
          <li>
            <strong>Security.</strong> We apply the measures described in section 8 of the <a href="/privacy">privacy policy</a>.
          </li>
          <li>
            <strong>Sub-processors.</strong> You agree that we use Microsoft Corporation and its affiliates (Azure hosting) in the region {SITE.region}. We will update this
            page before we add or replace a sub-processor. Microsoft's own data protection terms, including international transfer safeguards, apply to its services.
          </li>
          <li>
            <strong>Help with rights and obligations.</strong> We help you, as far as reasonable, to answer requests from participants (access, correction, erasure and
            others) and with your security, breach-notification and impact-assessment duties. The service lets you correct and delete data yourself.
          </li>
          <li>
            <strong>Personal data breaches.</strong> We inform you without undue delay after we become aware of a breach that affects your games.
          </li>
          <li>
            <strong>Deletion.</strong> When a game is deleted, its data is removed permanently. We keep no other copies.
          </li>
          <li>
            <strong>Proof of compliance.</strong> We will provide reasonable information and cooperation necessary to demonstrate compliance with Article 28 GDPR,
            including facilitating audits and inspections where legally required. You and we will coordinate such activities to minimise disruption and protect the
            security of the service and other users.
            <br />
            <strong>Audit procedures.</strong> Audits should normally be requested in writing at least 30 days in advance and conducted no more than once every 12 months,
            except where an earlier or additional audit is reasonably necessary due to a security incident, suspected non-compliance, or a legal or regulatory
            requirement. Audits will ordinarily begin with available documentation, written responses, publicly available source code, and relevant third-party audit
            reports, including those provided by Microsoft for its services. Further inspections will be coordinated where necessary, taking into account security,
            confidentiality, and proportionality. Each party bears its own ordinary costs. Any exceptional costs requiring substantial additional effort will be
            discussed and agreed in advance, without restricting mandatory audit rights under applicable law.
          </li>
        </ol>

        <h2 id="availability">10. Availability, changes and termination</h2>
        <p>
          We may change, limit, suspend or end the service, or any feature, at any time, with or without notice, and we may close accounts or games that break these
          terms. If the service ends, we will try to give notice on the start page but we do not promise to. You may stop using the service at any time.
        </p>

        <h2 id="liability">11. Liability</h2>
        <ul>
          <li>
            We are not liable for indirect or consequential damage, loss of profit, loss of data or damage that you could have avoided, for example by exporting results.
          </li>
          <li>
            Because the service is free of charge, we are liable only for intent and gross negligence, and for injury to life, body or health, and as far as liability
            cannot be limited by law (including mandatory consumer protection and data protection law).
          </li>
          <li>You are responsible for the content you add and for how you use the results.</li>
        </ul>

        <h2 id="changes">12. Changes to these terms</h2>
        <p>
          We may change these terms, for example when the service changes. The date at the top shows the latest version. If you keep using the service after a change,
          you accept the new terms. We will point out important changes on the start page.
        </p>

        <h2 id="law">13. Governing law</h2>
        <p>
          These terms are governed by the law of <Fill value={legal.governingLaw} label="governing law" />, excluding rules that would lead to another country's law.
          If you are a consumer, you also keep the protection of the mandatory rules of the country where you live, and you may bring a claim in the courts there.
        </p>

        <h2 id="contact">14. Contact</h2>
        <p>
          <Fill value={legal.operatorName} label="operator name" /><OperatorAddress />, email{' '}
          <Fill value={legal.contactEmail} label="contact email" />. Send privacy requests and security reports by email, not as public issues.
        </p>
      </div>
    </SiteLayout>
  );
}
