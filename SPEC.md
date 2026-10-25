# Connect the Dots — The Human Network — Spec

## 1. Concept
A web-based team-building game for offsites and workshops. 10–50 people in one room talk to each other in person, discover what they have in common (hobbies, countries, past jobs, etc.), and record each discovery as a labeled connection between two people. The result is a live "human network" graph that the facilitator projects on the big screen.

**Audience:** managers / teams at offsites (adult professionals).
**Roles:** Admin (facilitator, many allowed) and Player (anyone in the room).

### Offline game format (the web app supports this)
Participants' names go on a (virtual) whiteboard. People circulate, uncover shared experiences and draw labeled lines linking their names.

Example topics: play tennis; grew up in the same country; previously worked at the same company; have dogs; visited the same unusual place; play an instrument; began as software engineers; share a game or hobby.

**Three rounds (10 min each):**
1. **Find Your People:** discover and record commonalities.
2. **Unexpected Connections:** find unusual links; "we work at the same company" no longer counts.
3. **Connect the Network:** work together so everyone belongs to one connected network.

**Bonus prompts:** find someone who lived in three countries, has an unfamiliar hobby, changed industries, or shares an experience with five or more colleagues.

## 2. Gameplay and rules

### Player flow
1. Open the game URL and enter the game's **digit code** (no sign-in for players).
2. **Pick who you are** from the participant list, once. The choice is remembered on that device and the player cannot change it afterwards. There are no further limits for now: several devices may pick the same name, and the admin does not need a reset function in v1.
3. **Add a connection:** choose the person to connect with, then choose a **topic** (pick an existing one or add a new one). Topics added by any player are immediately available to all other players in the same game.
4. **Delete** an existing connection. Either of the two people in it can delete it: the one who created it or the one it was created with. A confirmation dialog ("Are you sure you want to delete it?") prevents accidental deletes.
5. See **only their own connections** (not the full network; the full graph is shown on the big screen).

### Admin flow
- Sign in with a Microsoft account (personal or company/work account, whichever is easiest to implement).
- Create games (each gets a digit code) and see only the games they created.
- Delete a game they created; this permanently deletes all its data (participants, topics, connections).
- Load the participant list from a `.txt` file (one "Name Surname" per line). On the admin page the admin can **add or delete participants at any time**, including while the game is running.
- Define the starting topic list for a game. The admin can **delete a topic at any time during the game**; deleting a topic also deletes all connections made with it (a confirmation states how many connections will be removed). The admin can also **merge similar topics** (for example "Dogs" and "dogs"): pick a source and a target topic, and all connections of the source move to the target. If a pair would end up connected twice on the target topic, only one connection is kept.
- Extend a game's expiry date.
- Show the results: open the projection view of the connection graph for the big screen.
- Delete any connection from the admin page.
- Optionally start / pause / reset the game timer (default 30 min, editable) and open the Timer screen.
- Any number of admins can exist; anyone who signs in becomes an admin (no pre-approval list). Each admin controls only the games they created, and admins cannot see or change each other's games.
- Set the game's **short URL** and the short rules text. The admin can paste any link (for example from aka.ms) or click "Generate a short link with is.gd": the API (`POST /api/manage/games/{gameId}/shortlink`) asks is.gd for a short link to `<site>/join/<code>` of the admin's own game and returns it to be put in the text box; if is.gd fails, the admin sees "Sorry, is.gd is not available today.". The app otherwise only stores and displays the link.

### Timer screen (big-screen view, shown while people circulate and make connections)
Shown on the projector during the activity. It contains:
- **Countdown timer** (large, readable from the back of the room; visual warning at the last minutes).
- **Short rules of the game:** what the game is and what is expected from people in the room (walk around, talk in person, find shared interests, add each connection in the app). Default text provided; the admin can edit it.
- **Where to find the app:** the admin's short URL in large text, the game's digit code and a **QR code** that opens the game join page.
- **Live graph:** the connection graph as dots, names optional/hidden (admin toggle), with new lines appearing instantly and animated as connections are added. A small counter strip (connections, groups, unconnected people) is optional.
- The admin can switch between the Timer screen and the full Results graph view (with names) from the admin page.
- **When the timer reaches zero:** a notification is shown (visual, optional sound) on the Timer screen. The game does **not** stop; players can keep adding and deleting connections.

### Rules and open mechanics
- **Connection** = two participants + one topic. It is created immediately by one person; the other person does **not** need to confirm it (but can delete it). Two people can have several connections between them, but each on a **different** topic: the same pair cannot be connected twice on the same topic (the app rejects it with a friendly message).
- **Rounds and timer:** the three rounds are run by the facilitator in the room. The admin can optionally start a countdown timer for the game (default 30 minutes, adjustable) that drives the Timer screen (see "Timer screen" above). A per-round indicator is a later nice-to-have.
- **Win / goal:** by Round 3 everyone belongs to one connected network (the graph has a single connected component). The app can show how many separate groups remain and who is isolated.
- **Mistakes / deletion:** a connection can be deleted by either person in it (the creator or the person it was created with) and by an admin from the admin page. Other players cannot delete it.

## 3. Content
- **Participants:** loaded by the admin per game as a `.txt` file with one "Name Surname" per line; participants can be added or deleted later on the admin page at any time (deleting a participant also removes their connections). Participant names must be **distinct** (case-insensitive, trimmed): duplicates inside the file, or names already in the game, are silently skipped, never added twice.
- **Topics:** every new game starts with ten default topics (with an emoji each, such as "🎾 Play tennis" and "🐕 Have dogs"); the admin can delete, merge or add topics at any time and restore the defaults with one click; players can add new ones during the game. A topic name has at most 30 characters; a longer name is shortened and ends with "…" (it is never refused).
- **Bonus prompts:** optional list the admin can show or send to players.
- **Timer:** one optional countdown per game, default 30 minutes (the facilitator can split it into the three 10-minute rounds verbally).
- **Rules text:** default short rules and expectations text, editable by the admin per game.
- **Short URL:** provided by the admin per game (created outside the app).

## 4. Tech and platform
- **Runs on:** web. Players on phones (mobile-first); admin and projection view on a laptop / big screen.
- **Backend:** Azure (required).
- **Admin authentication:** Microsoft sign-in, accepting both personal Microsoft accounts and work/school accounts (Microsoft Entra ID app registration set to "any organizational directory and personal Microsoft accounts"). Game ownership is tied to the signed-in user's ID.
- **Player access:** game URL + 6-digit game code (unique among active games), no accounts.
- **Game expiry and cleanup:** every game expires **3 days** after creation by default (configurable per game). After expiry the game is closed (players can no longer join or edit). The game and all its data are permanently deleted automatically **30 days after the expiry date** (a daily cleanup job). Admins can still delete a game manually at any time.
- **Real-time:** connections and topics must appear live for the other players and on the projected graph.
- **Azure deployment:** one Azure subscription; region: US (for example East US 2 or Central US, final choice at provisioning); resources in one resource group.
- **Database:** Azure Table Storage (decided).
- **Proposed stack (to confirm):**
  - Frontend: TypeScript web app (React or similar) with a graph library (D3 force layout or Cytoscape.js).
  - Hosting: Azure Static Web Apps, Free plan (built-in Microsoft sign-in for admins, personal and work accounts).
  - API: Azure Functions.
  - Data: Azure Table Storage (games, participants, topics, connections). Tables are partitioned by game, so each game's data is read and deleted as one unit.
  - Real-time: lightweight polling (about every 2 seconds) in v1 to stay on free tiers; Azure Web PubSub as an optional later upgrade.
  - CI/CD: GitHub Actions deploys to Azure automatically on every change to `main` (see PLAN.md).
- **Sharing:** one public URL; players join with a code.
- **Repo:** https://github.com/vityabool/connect-the-dots

## 5. Look and feel
- **Style:** playful but professional, clean, high contrast for projection.
- **UI language:** English only in v1. Other languages (for example Ukrainian) come later, so keep UI text separate from code to make translation easy.
- **Player screens:** large touch targets, minimal steps (pick person, pick topic, done).

### Graph design ideas (big-screen projection)
Core: dots = people (with names), lines = connections.

1. **Classic force-directed network.** Dots float and cluster naturally. Highly connected people drift to the center, loners stay on the edge. Lines are labeled with the topic on hover or when new.
2. **Color by topic.** Each topic gets its own color for its lines, with a legend. Several topics between the same pair are drawn as parallel curved lines.
3. **Dot size by connection count.** More connections = bigger dot, so "super-connectors" stand out.
4. **Cluster halos.** A soft colored background around each connected component. Goal in Round 3: halos merge into one. Isolated people get a pulsing outline so the room can see who still needs a connection.
5. **Live animation.** A new connection draws as an animated line with the topic label popping up briefly; confetti or a glow when two groups merge.
6. **Progress counters.** A strip such as "Connections: 42 · Groups: 3 · Unconnected people: 2".
7. **Circular layout (alternative view).** Everyone placed on a circle, connections as arcs inside it. Very readable with 50 people, with names around the rim; a toggle between force and circular views.
8. **Topic filter / spotlight.** The admin clicks a topic to highlight only those lines (for example, "show everyone who has dogs"), and clicks a person to highlight their links.
9. **Light / dark projection themes** and large-font mode for readability from the back of the room.

**Recommended default:** force-directed graph + color by topic + dot size by connections + glowing halo on isolated people + counters strip. Offer the circular view as a toggle.

### End-of-game results views
The admin picks a view from the results page and projects it. Each view is also exportable as an image.

1. **Network graph (main view).** The full force-directed graph with names, topic-colored lines, dot size by number of connections, isolated people highlighted.
2. **Top topics.** Horizontal bar chart of the most used topics ("Dogs: 14 connections"). Clicking a bar highlights those lines on the graph.
3. **Super-connectors.** Leaderboard of people with the most connections and the most different topics ("Connector of the day").
4. **Unexpected links.** Pairs connected through rare topics (used only once or twice), which fits the Round 2 spirit.
5. **Groups and completeness.** Number of separate groups, the people still isolated, and a clear "Everyone is connected!" celebration when the network forms a single group.
6. **Topic spotlight.** Pick a topic and see only the people and lines for it, with a name list ("Everyone who plays an instrument").
7. **Connection matrix.** People on both axes, a filled cell for each connection; shows who talked to whom and gaps in the room.
8. **Timeline replay.** The graph grows again from the first to the last connection in a short animation.
9. **Summary card.** One slide with headline numbers: people, connections, topics, groups, top topic, top connector.

**All nine results views are in v1** (decided).

## 6. Scope
### Must have for v1
- Admin sign-in with a personal or work Microsoft account; unlimited admins, each seeing only their own games
- Create games with a digit code; delete a game together with all its data
- Load the participant list from a .txt file (one name per line); admin can add / delete participants at any time
- Game auto-expiry after 3 days by default (game closes); admin can extend the expiry date
- Admin can delete a topic during the game (all its connections are deleted too) and merge similar topics
- All nine results views: Network graph, Top topics, Super-connectors, Unexpected links, Groups and completeness, Topic spotlight, Connection matrix, Timeline replay, Summary card (each exportable as an image)
- Timer-at-zero notification that does not stop the game
- Players see only their own connections
- Ten default topics in every new game (editable and deletable by the admin)
- Player join by URL + digit code; pick identity once
- Add a connection (person + topic), including adding a new topic that is instantly shared in the game
- Optional game timer (default 30 min) with a big-screen Timer screen: countdown, short rules, short URL + game code + QR code, live graph of dots with new lines appearing instantly (names optional)
- Delete a connection with an "Are you sure?" confirmation (either person in it; admins can delete any connection from the admin page)
- Live projection graph (dots with names, labeled lines) updating in real time
- Azure backend

### Nice to have later
- Per-round indicator (rounds 1-3) on the Timer screen
- Bonus prompts
- Circular layout, topic filter, cluster halos, animations
- Export results (image / PDF / CSV)
- Other UI languages (for example Ukrainian)
- Game archive / reuse of participant lists across games

### Out of scope
- Player accounts or passwords
- In-app chat or video
- Mobile native apps

## 7. Open questions
- None at the moment. Remaining details (exact Azure region, resource names) are decided during implementation.
