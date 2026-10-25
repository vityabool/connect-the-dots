import { JoinForm } from '../play/JoinForm';
import { IssuesLink, SiteLayout, SourceLink } from './Layout';
import { Showcase, type Slide } from './Showcase';
import { SITE } from './siteConfig';

/** A decorative picture of a small network: dots (people) joined by colored lines (things they share). */
function HeroArt() {
  const dots: [number, number, number][] = [
    [60, 110, 11],
    [150, 50, 13],
    [250, 90, 10],
    [340, 40, 12],
    [120, 190, 12],
    [235, 185, 15],
    [335, 150, 11],
    [60, 270, 10],
    [170, 290, 12],
    [300, 280, 13],
  ];
  const lines: [number, number, string][] = [
    [0, 1, '#38bdf8'],
    [1, 2, '#f472b6'],
    [2, 3, '#facc15'],
    [1, 4, '#4ade80'],
    [4, 5, '#a78bfa'],
    [2, 5, '#fb923c'],
    [5, 6, '#2dd4bf'],
    [3, 6, '#38bdf8'],
    [4, 7, '#f472b6'],
    [4, 8, '#facc15'],
    [5, 8, '#4ade80'],
    [5, 9, '#a78bfa'],
    [6, 9, '#fb923c'],
    [8, 9, '#38bdf8'],
    [0, 4, '#2dd4bf'],
  ];
  return (
    <svg viewBox="0 0 400 330" role="img" aria-label="Illustration: ten people shown as dots, joined by colored lines" fontFamily="system-ui, sans-serif">
      {lines.map(([a, b, color]) => (
        <line
          key={`${a}-${b}`}
          x1={dots[a]?.[0]}
          y1={dots[a]?.[1]}
          x2={dots[b]?.[0]}
          y2={dots[b]?.[1]}
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}
      {dots.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#f8fafc" stroke="#0b1220" strokeWidth={3} />
      ))}
    </svg>
  );
}

/** A picture of a slide: a link to the big version (it works without JavaScript; the carousel opens it in an overlay instead). */
function picture(file: string, alt: string): Pick<Slide, 'visual' | 'zoom'> {
  return {
    visual: (
      <a className="showcase-link" href={`/screens/${file}-full.webp`}>
        <img src={`/screens/${file}.webp`} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" />
      </a>
    ),
    zoom: <img src={`/screens/${file}-full.webp`} alt={alt} width={3200} height={2000} decoding="async" />,
  };
}

/** The pictures are screenshots of a sample game (see docs/screenshots), composed by scripts/make-landing-slides.mjs. */
const SLIDES: Slide[] = [
  {
    id: 'network',
    title: 'Dots are people, lines are what they share',
    text: 'Every connection a team finds becomes a colored line between two names.',
    visual: (
      <div className="showcase-art">
        <HeroArt />
      </div>
    ),
    zoom: (
      <div className="showcase-art showcase-art-zoom">
        <HeroArt />
      </div>
    ),
  },
  {
    id: 'facilitator',
    title: 'Set up a game in a few minutes',
    text: 'Sign in, upload the list of names, add starter topics and set a timer. Players only need the code.',
    ...picture('slide-facilitator', 'The facilitator page: the game code, the list of participants and the timer settings'),
  },
  {
    id: 'phones',
    title: 'Join with a code on any phone',
    text: 'Pick your name, choose a colleague and a topic you share, and you are done. No account, no app.',
    ...picture('slide-phones', 'Three phones: picking a name, adding a connection with a colleague and a topic, and the list of my connections'),
  },
  {
    id: 'timer',
    title: 'A big screen that keeps everyone on track',
    text: 'A countdown, the rules, the join code, a QR code and the network growing live.',
    ...picture('slide-timer', 'The Timer screen for the projector: a 30 minute countdown, the join code and QR code, the rules and the live network'),
  },
  {
    id: 'results',
    title: 'Watch the network grow',
    text: 'People, connections and groups at a glance. When everyone is joined into one network, the room celebrates.',
    ...picture('slide-network', 'The network view: ten people joined by colored lines with a legend of the topics'),
  },
  {
    id: 'insights',
    title: 'Nine ways to look at the result',
    text: 'Top topics, super-connectors, surprising links, who met whom, a replay and more, each exportable as an image.',
    ...picture('slide-results', 'The results views: top topics as a bar chart and the who-met-whom matrix'),
  },
];

const FEATURES = [
  { icon: '📱', title: 'Nothing to install', text: 'Players open a link or scan a QR code on their phone, enter a 6-digit code and pick their name. No accounts, no apps.' },
  { icon: '🌐', title: 'A live network on the big screen', text: 'Every connection appears as a colored line the moment it is added, so the whole room watches the network grow.' },
  { icon: '⏱️', title: 'Timer, rules and QR code', text: 'A projector screen with a countdown, the rules, the join code and a QR code keeps everybody on track.' },
  { icon: '📊', title: 'Nine ways to look at the result', text: 'Top topics, super-connectors, surprising links, who is still alone, a replay and more, each exportable as an image.' },
  { icon: '🔒', title: 'Private by design', text: 'Players only see their own connections. No advertising, no tracking, and games delete themselves after a few weeks.' },
  { icon: '🧩', title: 'Your topics, your game', text: 'Start with ideas such as "Play tennis" or "Have dogs"; players add their own and the facilitator can merge or remove topics.' },
];

const FAQ = [
  { q: 'What is Connect the Dots?', a: 'A team-building game for groups of about 10 to 50 people in one room. People talk to each other, find things they have in common and record each discovery as a connection between two names. A facilitator projects the growing network of connections.' },
  { q: 'Do players need an account?', a: 'No. Players need only the game code (or the link or QR code) and the list of names that the facilitator prepared. Facilitators sign in with a Microsoft account.' },
  { q: 'Is it really free?', a: 'Yes. It is free to use as it is, without support or warranty. Please read the terms of service.' },
  { q: 'What happens to our data?', a: 'Only the names that the facilitator uploads and the connections people add are stored. Games close automatically after a few days and are deleted 30 days later, or immediately when the facilitator deletes them. See the privacy policy for details.' },
];

export function Landing() {
  return (
    <SiteLayout current="home">
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Team building for offsites and workshops</p>
            <h1>
              Turn a room full of colleagues into a <span className="gradient-text">human network</span>
            </h1>
            <p className="lead">{SITE.description}</p>
            <div className="hero-actions">
              <a className="btn" href="/#facilitators">
                Run a game
              </a>
              <a className="btn btn-ghost" href="/how-to-play">
                How to play
              </a>
            </div>
          </div>
          <div id="join" className="join-card">
            <h2>Have a game code?</h2>
            <p className="muted">Your facilitator shows a 6-digit code (and a QR code) on the big screen.</p>
            <JoinForm className="form join-form" hint={false} />
          </div>
        </div>
        <div className="wrap showcase-wrap">
          <Showcase slides={SLIDES} label="Connect the Dots in pictures" />
        </div>
      </section>

      <section id="how-it-works" className="section section-alt">
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h2>Three steps from strangers to a network</h2>
          <div className="grid grid-3">
            <div className="card-box">
              <span className="step-number">1</span>
              <h3>The facilitator sets up a game</h3>
              <p>Sign in, create a game, upload the list of participants and show the join code and QR code on the big screen.</p>
            </div>
            <div className="card-box">
              <span className="step-number">2</span>
              <h3>Everyone joins on their phone</h3>
              <p>Enter the 6-digit code, choose your name from the list and you are in. It takes about half a minute.</p>
            </div>
            <div className="card-box">
              <span className="step-number">3</span>
              <h3>Talk, connect, watch it grow</h3>
              <p>Walk around, find what you have in common (a hobby, a country, a pet, a past job) and add it as a connection. The network on the screen grows with every conversation.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <p className="eyebrow">Why teams like it</p>
          <h2>Simple for players, useful for facilitators</h2>
          <div className="grid grid-3">
            {FEATURES.map((feature) => (
              <div className="card-box" key={feature.title}>
                <div className="feature-icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="rules" className="section section-alt">
        <div className="wrap">
          <p className="eyebrow">The rules in brief</p>
          <h2>Three rounds, ten minutes each</h2>
          <div className="rounds">
            <div className="round">
              <span className="time">10 min</span>
              <h3>1. Find your people</h3>
              <p>Discover and record the things you share with colleagues.</p>
            </div>
            <div className="round">
              <span className="time">10 min</span>
              <h3>2. Unexpected connections</h3>
              <p>Look for unusual links. "We work at the same company" no longer counts.</p>
            </div>
            <div className="round">
              <span className="time">10 min</span>
              <h3>3. Connect the network</h3>
              <p>Work together until everybody belongs to one connected network.</p>
            </div>
          </div>
          <p>
            <a href="/how-to-play">Read the full guide for players and facilitators →</a>
          </p>
        </div>
      </section>

      <section id="facilitators" className="section">
        <div className="wrap">
          <p className="eyebrow">For facilitators</p>
          <h2>Run a game in ten minutes</h2>
          <div className="grid grid-2">
            <div>
              <p className="lead">
                Sign in with a personal or work Microsoft account, create a game and you get a join code, a projector screen and a results page. You only
                ever see the games you created.
              </p>
              <ul>
                <li>Upload participants from a simple text file, one name per line.</li>
                <li>Start the timer and open the big-screen view with the live network, the rules and the QR code.</li>
                <li>Merge similar topics, remove mistakes and see the results in nine views.</li>
                <li>Delete the game and all its data whenever you like.</li>
              </ul>
              <div className="hero-actions">
                <a className="btn" href="/admin">
                  Facilitator sign-in
                </a>
                <a className="btn btn-ghost" href="/how-to-play#facilitators">
                  Facilitator guide
                </a>
              </div>
            </div>
            <div className="notice-box notice-top" role="note">
              <p>
                <strong>Free, as is.</strong> This service is free to use as it is, without support, warranty or service level. It can change or stop at any
                time. Games are kept for a limited time only, so export the results you want to keep. Please read the{' '}
                <a href="/terms">terms of service</a> and the <a href="/privacy">privacy policy</a> before you run a game with your colleagues.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="open-source" className="section section-alt">
        <div className="wrap">
          <p className="eyebrow">Open source</p>
          <h2>The code is open source</h2>
          <div className="grid grid-2">
            <div>
              <p className="lead">
                Connect the Dots is free software under the <a href={SITE.license.url} rel="noopener">{SITE.license.name}</a>. You can read it, run your own copy and
                improve it.
              </p>
              <p>
                <SourceLink />
              </p>
            </div>
            <div className="card-box">
              <h3>Ideas, bug reports and complaints</h3>
              <p>
                All feedback goes to GitHub issues, where everybody can see it: <IssuesLink>open an issue</IssuesLink>. This is a hobby-scale project without
                support, so please expect no guaranteed reply or deadline. Do not post personal data or security problems in public issues; the{' '}
                <a href="/privacy#rights">privacy policy</a> explains how to reach us privately.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap faq">
          <p className="eyebrow">Questions</p>
          <h2>Quick answers</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <div className="answer">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
          <p>
            <a href="/how-to-play#faq">More questions and answers →</a>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
