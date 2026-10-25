# Changelog

All notable changes to this project are listed here.

## 1.0.0

First public release of Connect the Dots: The Human Network, a free team-building game for offsites and workshops.

### The game

- Facilitators sign in with a Microsoft account (personal or work), create a game with a 6-digit code (it expires after 3 days
  and can be extended to 30), upload the participant list and edit the ten starter topics.
- Players join with the code on their phone, pick their name once and add connections (a person plus a topic, existing or new).
  They only see their own connections. No player accounts.
- Live updates by polling (about every 2 seconds) for players, the facilitator and the big screens.
- Timer screen for the projector: countdown, rules, short link, game code, QR code and a live network graph. Time running out
  does not stop the game.
- Nine results views, each exportable as an image: network, top topics, super-connectors, unexpected links, groups, topic
  spotlight, who met whom, replay and summary.
- Facilitators can add and remove participants, delete or merge topics and delete connections at any time.

### Privacy and operations

- No analytics, advertising, third-party scripts or cookies beyond what is needed to run a game.
- Games and all their data are deleted automatically 30 days after they expire, by a daily cleanup job. Client addresses are
  never stored, only a keyed hash used to slow down guessing of game codes.
- Public pages: landing page, how to play, privacy policy and terms of service (static pages with search-engine metadata).
- Accessibility checks (WCAG 2.1 AA practices) and a 50-player load test with no errors.

### Under the hood

- React, Vite and TypeScript front end; Azure Functions API on Azure Table Storage; infrastructure as code (Bicep);
  GitHub Actions for tests, deployment and the daily cleanup.
- MIT License. All shipped third-party packages use permissive licenses; the pipeline checks this.
- The player endpoints refuse a `TOKEN_SIGNING_SECRET` shorter than 32 characters.
