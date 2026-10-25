import { IssuesLink, SiteLayout } from './Layout';
import { SITE } from './siteConfig';

/** Questions and answers (plain text so they can also be given to search engines as structured data). */
export const HOW_TO_PLAY_FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need an account to play?',
    a: 'No. Players only need the 6-digit game code (or the link or QR code) and the name that the facilitator put on the participant list. Only facilitators sign in, with a personal or work Microsoft account.',
  },
  {
    q: 'I picked the wrong name. What now?',
    a: 'Tap "Wrong game? Start over" on the name screen to join again. If you already added connections under the wrong name, ask the facilitator: they can remove those connections.',
  },
  {
    q: 'Who can see my connections?',
    a: 'On their phones, players only see their own connections. The facilitator sees all connections of the game, and the network (names and lines) is shown on the big screen.',
  },
  {
    q: 'Can I delete a connection?',
    a: `Yes. Either of the two people in a connection can delete it, after a confirmation. The facilitator can delete any connection.`,
  },
  {
    q: 'Can the same two people be connected twice?',
    a: 'Yes, but each connection needs a different topic. Two people who both play tennis and both have dogs have two connections.',
  },
  {
    q: 'How many people can play?',
    a: `A game can have up to ${SITE.limits.participants} participants and ${SITE.limits.topics} topics. The game is designed for groups of about 10 to 50 people in one room.`,
  },
  {
    q: 'How long are games kept?',
    a: `A game closes ${SITE.limits.defaultExpiryDays} days after it was created (the facilitator can extend this up to ${SITE.limits.maxExpiryDays} days) and is deleted automatically ${SITE.limits.retentionAfterExpiryDays} days after it closed. The facilitator can delete it at any time. Export the results you want to keep.`,
  },
  {
    q: 'Is there support?',
    a: 'No. The game is free to use as it is, without support, warranty or service level. You can report problems and suggest ideas as GitHub issues, but there is no promise of an answer.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. There is no advertising and no paid plan.',
  },
  {
    q: 'Does it work on any phone?',
    a: 'It works in the current versions of the common mobile and desktop browsers. The big-screen views are made for a projector or a large laptop screen.',
  },
];

export function HowToPlay() {
  return (
    <SiteLayout current="how-to-play">
      <div className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Guide</p>
          <h1>How to play Connect the Dots</h1>
          <p className="lead">
            Everything players and facilitators need to know: the rules, the three rounds, how to set up a game and how to read the results.
          </p>
        </div>
      </div>

      <div className="wrap prose">
        <nav className="toc" aria-label="On this page">
          <strong>On this page</strong>
          <ol>
            <li>
              <a href="#idea">The idea</a>
            </li>
            <li>
              <a href="#players">For players</a>
            </li>
            <li>
              <a href="#rounds">The three rounds</a>
            </li>
            <li>
              <a href="#rules">Rules and conditions of play</a>
            </li>
            <li>
              <a href="#facilitators">For facilitators</a>
            </li>
            <li>
              <a href="#faq">Questions and answers</a>
            </li>
          </ol>
        </nav>

        <h2 id="idea">The idea</h2>
        <p>
          People in a room put their names on a shared board. They walk around, talk to each other in person and uncover what they have in common: a sport,
          a country, a pet, a past employer, an unusual place they both visited. Every discovery is recorded as a labeled line between two names. After
          half an hour the room has built a picture of itself: a human network.
        </p>
        <p>Example topics: play tennis, grew up in the same country, previously worked at the same company, have dogs, play an instrument, began as software engineers.</p>

        <h2 id="players">For players</h2>
        <ol>
          <li>Open the join link or scan the QR code shown on the big screen, or open this site and enter the 6-digit game code.</li>
          <li>Choose your name from the list and confirm. You only do this once.</li>
          <li>Find a colleague, have a real conversation and discover something you share.</li>
          <li>Tap <strong>Add connection</strong>, choose the person and the topic (or add a new topic) and save. The line appears on the big screen within a couple of seconds.</li>
          <li>Made a mistake? Delete the connection (either of the two people can do it). You will be asked to confirm.</li>
        </ol>
        <p>You only see your own connections on your phone. The whole network is shown on the big screen.</p>

        <h2 id="rounds">The three rounds</h2>
        <p>The facilitator runs the rounds out loud; the timer on the screen counts the time (30 minutes by default).</p>
        <div className="rounds">
          <div className="round">
            <span className="time">10 min</span>
            <h3>1. Find your people</h3>
            <p>Discover and record commonalities with as many colleagues as you can.</p>
          </div>
          <div className="round">
            <span className="time">10 min</span>
            <h3>2. Unexpected connections</h3>
            <p>Find unusual links. Obvious ones such as "we work at the same company" no longer count.</p>
          </div>
          <div className="round">
            <span className="time">10 min</span>
            <h3>3. Connect the network</h3>
            <p>Work together so that everybody belongs to one connected network. People who are still alone pulse on the screen: go and talk to them.</p>
          </div>
        </div>
        <h3>Bonus challenges</h3>
        <ul>
          <li>Find someone who has lived in three countries.</li>
          <li>Find someone with a hobby you have never heard of.</li>
          <li>Find someone who changed industries.</li>
          <li>Find an experience you share with five or more colleagues.</li>
        </ul>

        <h2 id="rules">Rules and conditions of play</h2>
        <ul>
          <li>
            <strong>Talk in person.</strong> The point of the game is the conversation. Add a connection only after you really found something in common.
          </li>
          <li>
            <strong>Be truthful and kind.</strong> Add only connections that are true and that both people are comfortable with. Either person can delete a
            connection.
          </li>
          <li>
            <strong>Keep topics friendly and professional.</strong> No health, religion, politics, sexuality or other sensitive private details, and nothing
            offensive or discriminatory. The facilitator can remove topics and connections.
          </li>
          <li>
            <strong>No personal data in topics.</strong> A topic is a general theme ("Play chess"), not a statement about a private person's secrets.
          </li>
          <li>
            <strong>Use it fairly.</strong> One phone, one person. Do not guess other games' codes and do not overload or attack the service (see the{' '}
            <a href="/terms">terms of service</a>).
          </li>
          <li>
            <strong>Free, as is.</strong> The game is provided without support or warranty. Results are kept only for a limited time, so export what you want to
            keep.
          </li>
          <li>
            <strong>Your data.</strong> The <a href="/privacy">privacy policy</a> explains what is stored. The facilitator of your game is responsible for the participant
            list and is your first contact for questions about it.
          </li>
        </ul>

        <h2 id="facilitators">For facilitators</h2>
        <h3>Before the event</h3>
        <ol>
          <li>
            Open <a href="/admin">the facilitator page</a> and sign in with a personal or work Microsoft account.
          </li>
          <li>Create a game. It gets a 6-digit code and stays open for {SITE.limits.defaultExpiryDays} days (you can extend it).</li>
          <li>
            Add the participants: upload a text file with one name per line (save it as UTF-8) or paste the names. Duplicates are skipped. You can add or remove
            people at any time.
          </li>
          <li>Ten starter topics are already there (such as "Play tennis" and "Have dogs"). Change or delete them and add your own; players can add theirs during the game.</li>
          <li>
            Optionally set a short link (for example one you made with a link shortener), your own rules text and whether names are shown on the big screen.
          </li>
        </ol>
        <h3>During the event</h3>
        <ol>
          <li>Open the Timer screen on the projector. It shows the countdown, the rules, the join code, a QR code and the live network.</li>
          <li>Start the timer and run the three rounds. At zero the screen says "Time's up!" but the game keeps going.</li>
          <li>Tidy up as needed: merge similar topics ("Dogs" and "Have dogs"), delete a topic or a connection, add late participants.</li>
        </ol>
        <h3>After the event</h3>
        <ol>
          <li>Open the results: network, top topics, super-connectors, unexpected links, groups, topic spotlight, a "who met whom" grid, a replay and a summary.</li>
          <li>Export the views you want to keep as images.</li>
          <li>
            Delete the game when you are done. Otherwise it closes after its expiry date and is deleted {SITE.limits.retentionAfterExpiryDays} days after that.
          </li>
        </ol>
        <p>
          <strong>Your responsibilities.</strong> As the facilitator you decide whose names go into the game. Make sure you may use them for this purpose and tell
          the participants (the <a href="/privacy">privacy policy</a> can be shared with them). Do not upload sensitive data, and do not run games with children.
        </p>

        <h2 id="faq">Questions and answers</h2>
        <div className="faq">
          {HOW_TO_PLAY_FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <div className="answer">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
        <p>
          Something missing or wrong? <IssuesLink>Open an issue on GitHub</IssuesLink>. Please do not include personal data.
        </p>
      </div>
    </SiteLayout>
  );
}
