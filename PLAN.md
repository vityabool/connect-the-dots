# Implementation Plan — Connect the Dots: The Human Network

Companion to [SPEC.md](SPEC.md). Originally written before the build; the status section below records what was delivered and where the implementation differs from the first plan.

## Status: all milestones delivered (M0–M8)

| Milestone | Delivered |
|-----------|-----------|
| M0 | Project skeleton, shared logic, CI |
| M1 | Azure resources (Bicep), automatic deployment on every push to `main`, PR previews, Microsoft sign-in for admins |
| M2 | Games with unique 6-digit codes, 3-day expiry (extendable), `.txt` participant upload with distinct names, delete game with all data |
| M3 | Players join by code, pick a name, add connections (existing or new topic), see only their own, delete with confirmation; signed player tokens |
| M4 | Live updates by version polling (about 2 s) for players, admin and screens |
| M5 | Delete and merge topics, admin connection list and delete |
| M6 | Timer (start/pause/reset, server-side), big-screen Timer screen with rules, short link, code, QR code and live graph, time's-up notification that does not stop the game |
| M7 | Nine results views with PNG export |
| M8 | 50-player load test (0 errors), security headers and CSP verified on the production build, automated accessibility checks and contrast audit, crash screen, documentation |

### Differences from the first plan

- **API paths:** admin endpoints live under `/api/manage/*` because the Azure Functions host reserves `/api/admin/*`.
- **Real-time:** polling only (free tier); Web PubSub remains an optional later upgrade.
- **Preview environments** share production data (decided).
- **Game codes:** one `GameCodes` row per code (partition = code), so a taken code fails atomically.
- **Admin data:** the admin game endpoint returns everything the Timer screen and the results views need (participants, topics, connections, settings, timer), so no separate "results" endpoint exists.
- **Results views and the graph** are implemented with d3-force (layout only) and React SVG; image export uses `html-to-image`.
- **Automatic cleanup** (games deleted 30 days after expiry) was built after the first release as a daily GitHub Actions job (`cleanup.yml`) that calls a protected endpoint.
- **Not built (listed as "later" in the spec):** per-round indicator on the Timer screen, other UI languages, CSV/PDF export.

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for how it is run and checked.

## 1. Decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| D1 | Hosting plan | **Azure Static Web Apps Free** | Decided. Includes managed Functions API, free SSL and 3 staging (pull-request preview) environments. No SLA. |
| D2 | Admin sign-in | **Preconfigured Microsoft Entra ID provider** (`/.auth/login/aad`) | Decided and verified in the [Microsoft docs](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization): the preconfigured provider lets any Microsoft account sign in, personal or work/school, on every plan including Free. The GitHub provider is blocked by a route rule so only Microsoft sign-in is offered. |
| D3 | Real-time updates | **Cheap version polling** (about every 2 s) in v1; **Azure Web PubSub** is a later optional upgrade | Web PubSub's free tier allows only 20 concurrent connections, too few for 50 players plus screens, and the paid tier costs money. Polling is free-tier friendly and still feels near-instant (see section 2). |
| D4 | Backend runtime | **TypeScript** everywhere (React front end, Azure Functions API) | One language, shared types for API messages. |
| D5 | Environments | One `prod` environment (the Static Web App), pull-request preview environments for review, and local development (Azurite + Azure Functions Core Tools; the SWA CLI was not needed and was removed) | Keeps Azure cost at zero. |
| D6 | CI/CD | **GitHub Actions**: every push to `main` builds, tests and deploys automatically | See section 7. |

Everything runs on free tiers; the only cost is a few cents of Table Storage transactions per game.

## 2. Architecture

```
Players (phones)  ──┐
Admin (laptop)    ──┼──►  Azure Static Web Apps  ── hosts the React app + managed Azure Functions API
Big screen (web)  ──┘             │
                                  └──► Azure Table Storage        (all game data)

GitHub (push to main) ──► GitHub Actions ──► build + test ──► deploy to Static Web Apps
```

- **Front end:** one single-page React app with three areas: `/` and `/play` (players), `/admin` (admins), `/screen/:gameId/...` (big-screen views).
- **API:** Azure Functions (HTTP triggers, Node/TypeScript). No bindings are required: the API uses the `@azure/data-tables` SDK, so it runs fine as SWA managed functions.
- **Admin auth:** Static Web Apps built-in auth (preconfigured Microsoft Entra ID provider, accepts personal and work accounts). `staticwebapp.config.json` requires the `authenticated` role for `/admin/*` (web pages) and `/api/manage/*` (API; the Azure Functions host reserves `/api/admin/*` for itself), and returns 404 for `/.auth/login/github`. The API reads the signed-in user's ID from the `x-ms-client-principal` header. Game ownership = that user ID. Every admin API call checks that the game belongs to the caller.
- **Player auth (no accounts):** joining with the 6-digit code returns a short-lived signed **player token** (HMAC, secret in app settings) containing `gameId` and, after identity selection, `participantId`. Every player API call verifies it. The token is stored in the browser's local storage so a refresh keeps the identity.
- **Secrets:** storage connection string and the token-signing secret live in SWA application settings; deployment credentials live in GitHub Actions secrets. Nothing secret is in the repo.

### Real-time design (free-tier friendly polling)
- Each game row has a `version` number that the API increments on **every** write to that game (connection, topic, participant, timer or settings change).
- Clients poll `GET /api/state?since={version}` about every 2 seconds. If nothing changed the API answers `304`/empty after one tiny table read; otherwise it returns the new snapshot (or a delta). Players receive only their own connections; screens and admins receive the full game.
- Effect: a new line appears on the big screen within about 2 seconds, which feels live in a room. Polling backs off to about 10 s when the browser tab is hidden.
- Load estimate: 50 players + a few screens at 0.5 req/s each is about 25 small requests per second, well within the Free plan and costing cents in Table Storage transactions.
- The timer is computed from server timestamps (`timerEndsAt`), so all screens agree without extra traffic.
- **Later upgrade (optional):** add Azure Web PubSub to push a "version changed" hint so clients refetch immediately. The polling code stays as the fallback, so this is an additive change.

## 3. Data model (Azure Table Storage)

Table Storage has no cross-partition transactions and no joins, so the design uses the game ID as the partition key and builds uniqueness rules into the row keys.

| Table | PartitionKey | RowKey | Main properties | Notes |
|-------|--------------|--------|-----------------|-------|
| `Games` | `gameId` | `game` | `ownerId`, `name`, `code`, `createdAt`, `expiresAt`, `shortUrl`, `rulesText`, `timerMinutes`, `timerState` (`idle`/`running`/`paused`), `timerEndsAt`, `timerRemainingSec`, `showNamesOnScreen`, `version` (incremented on every write) | One row per game. |
| `GameCodes` | `code` | `code` | `gameId`, `expiresAt` | One row per code, so inserting a taken code fails atomically; a code is reusable once its game has expired (retry with another code on collision). |
| `OwnerGames` | `ownerId` | `gameId` | `name`, `createdAt` | Lists "my games" for an admin. |
| `Participants` | `gameId` | `hash(normalizedName)` | `displayName` | Normalized = trimmed, lower-cased, single spaces. The row key makes **duplicate names impossible**, so uploading or adding a duplicate is a no-op. |
| `Topics` | `gameId` | `hash(normalizedName)` | `displayName`, `createdBy`, `createdAt` | Same trick: a topic can exist only once per game (case-insensitive). |
| `Connections` | `gameId` | `minPid:maxPid:topicId` | `aId`, `bId`, `topicId`, `createdBy`, `createdAt` | Row key makes **the same pair + same topic impossible**; different topics for a pair are allowed. |

Operations that need care:
- **Delete a game / expiry cleanup:** delete rows by partition in batches of 100 (the Table Storage transaction limit), plus the `GameCodes` and `OwnerGames` rows.
- **Delete a topic:** query that game's connections where `topicId` matches, delete them in batches, then delete the topic.
- **Merge topics (source → target):** for each source connection, insert the same pair under the target topic (ignore "already exists"), delete the old row, then delete the source topic.
- **Delete a participant:** delete their connections (both directions, by filtering `aId`/`bId`), then the participant.
- Game sizes are small (≤ 50 people, a few hundred connections), so reading a whole game partition per request is cheap and keeps the logic simple.

## 4. API surface (all under `/api`)

**Player (token from join)**
- `POST /join` — `{code}` → game info + participant list + token
- `POST /identity` — `{participantId}` → token with identity
- `GET /state?since={version}` — poll for changes (own connections, topics, timer, game status)
- `POST /connections` — `{otherId, topicId | newTopicName}` (creates topic when needed; rejects duplicate pair+topic, self-connection, expired game)
- `DELETE /connections/{id}` — only the two people in it

**Admin (signed in; owner-only; all under `/api/manage`)**
- `GET /manage/games`, `POST /manage/games`, `GET|DELETE /manage/games/{id}`
- `PATCH /manage/games/{id}` — name, short URL, rules text, timer length, show-names toggle, expiry extension
- `POST /manage/games/{id}/participants` (single or `.txt` upload), `DELETE .../participants/{pid}`
- `POST|DELETE .../topics`, `POST .../topics/{id}/merge`
- `GET .../connections`, `DELETE .../connections/{id}`
- `POST .../timer` — `start | pause | reset`
- `GET .../results` — full snapshot (also used by the polling `state` call for screens and admins)

Rules enforced on the server for every write: game not expired, caller owns the game (admin) or belongs to it (player), input trimmed and length-limited.

## 5. Front-end screens

**Player:** join (6-digit code) → pick your name (searchable list) → home with *My connections* and a large "Add connection" button → add dialog (person picker, topic picker with "add new topic") → delete with "Are you sure you want to delete it?".

**Admin:** sign in → *My games* → game page with tabs: **Overview** (code, short URL, QR, rules text, expiry + extend, delete game), **Participants** (upload `.txt`, add, delete), **Topics** (add, delete, merge), **Connections** (list, delete), **Timer** (length, start/pause/reset), **Screens** (open Timer screen or Results in a new window for the projector).

**Big screen:** *Timer screen* (countdown, rules, short URL + game code + QR, live dots-only graph, zero-time notification) and *Results* with the nine views from the spec.

**Graph & charts:** D3 (`d3-force`, SVG). Force-directed layout with topic colors, dot size by connection count, glow on isolated people, animated new lines. Other views (bars, leaderboard, matrix, timeline replay) are hand-built SVG/HTML. Image export: SVG → canvas → PNG. QR code: `qrcode` library. All UI text lives in one strings file to make later translation easy.

## 6. Repository layout

```
/web      React + Vite + TypeScript app
/api      Azure Functions (TypeScript) + shared domain logic
/shared   Types and pure logic used by both (normalization, connected-groups, merge rules)
/infra    Bicep templates (storage account, static web app) + bootstrap script
/.github/workflows   ci-cd.yml (test, build, deploy, smoke test) and cleanup.yml (daily data retention)
SPEC.md  PLAN.md  README.md
```

## 7. CI/CD with GitHub Actions

**Goal:** every change merged or pushed to `main` is tested and deployed to production automatically; pull requests get a throwaway preview site.

### Workflow `ci-cd.yml`
| Trigger | What runs |
|---------|-----------|
| Pull request to `main` | `test` job, then deploy to a **preview environment** (Free plan allows 3 at once); the preview URL is posted on the PR; the preview is removed when the PR closes. |
| Push to `main` | `test` job, then **deploy to production**, then a smoke test. |
| Manual (`workflow_dispatch`) | Same as push; used to redeploy or roll back by re-running an older commit. |

Jobs:
1. **`test`:** checkout → Node 22 → `npm ci` → lint → license check → type-check → unit tests → API integration tests against Azurite → build web + API → end-to-end check of every API endpoint through the real Functions host. Any failure stops the pipeline, so a broken commit never deploys.
2. **`deploy`** (needs `test`, only for `main` pushes and PRs from this repo): `Azure/static-web-apps-deploy@v1` uploads `web` (build output `dist`) and `api` to the Static Web App. Uses the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` and the built-in `GITHUB_TOKEN`.
3. **`smoke`:** after a production deploy, `curl` the home page and `/api/health` and fail the run if they do not answer 200.
4. **`close-preview`:** on PR close, removes the preview environment.

Pipeline hygiene: least-privilege `permissions:`, a `concurrency` group so two pushes to `main` never deploy at the same time (newest wins), npm cache for fast runs, and pinned action versions.

### Infrastructure as code
- The Azure resources are defined in `infra/main.bicep` and provisioned with `infra/deploy.sh` (re-runnable, uses the operator's own `az login`; it keeps existing secrets). There is no infrastructure workflow: nothing in GitHub Actions has credentials to change Azure resources, only the deployment token for the site.

### Workflow `cleanup.yml` (data retention)
- Runs every day and calls the protected endpoint `POST /api/maintenance/cleanup` (header `x-cleanup-token`), which deletes games 30 days after they expired, old rate-limit counters and orphaned index rows. See [docs/OPERATIONS.md](docs/OPERATIONS.md).

### Secrets and settings
| Where | Name | Purpose |
|-------|------|---------|
| GitHub repo secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token of the Static Web App (retrieved with `az`, stored with `gh secret set`). |
| GitHub repo secret | `CLEANUP_TOKEN` | Sent by the daily cleanup workflow; the same value is an application setting of the Static Web App. |
| GitHub repo variable | `SWA_URL` | Address used by the smoke test and the cleanup workflow. |
| Static Web App application settings | `TABLES_CONNECTION_STRING`, `TOKEN_SIGNING_SECRET`, `CLEANUP_TOKEN` | Runtime configuration of the API; set by the provisioning step, not by every deployment. |

### Preview vs production
- **Production** = the app's main URL, updated only from `main`.
- **Preview** = a temporary site per pull request (up to 3 at once on the Free plan), deleted when the PR closes. Sign-in works the same way.
- **Data is shared (decided):** previews use the same Table Storage and settings as production. There is no table prefix or separate storage account. A game created while testing a preview therefore also shows up in production, so delete test games when done. Because each admin only sees their own games, other admins are not affected. Preview code must stay compatible with the production data format; schema changes need to be backward compatible.

### Branch rules and workflow
- **Direct pushes to `main` by the maintainer are allowed and deploy automatically** (decided), without a pull request. This is the normal path for small changes.
- **Everyone else works through pull requests.** Once the repository is public, a ruleset on `main` requires a pull request with
  the maintainer's approval (`.github/CODEOWNERS`), the passing check "Lint, test, build" and blocks force pushes; the maintainer can bypass it.
- A branch and pull request (with a preview site) is optional for the maintainer and used for larger or more visual changes.
- The deploy job refuses to run when tests fail, so a broken commit is never deployed.

### Rollback
Revert the bad commit (or re-run the workflow on the last good commit); the pipeline redeploys it in a few minutes.

## 8. Milestones

Each milestone ends with something you can run and review.

| M | Goal | Done when |
|---|------|-----------|
| **M0** | Project skeleton + CI | Vite app and Functions API run locally with Azurite and Azure Functions Core Tools; `ci-cd.yml` runs lint, type-check, tests and build on every push and pull request (deploy job added in M1). |
| **M1** | Azure foundation, CD and admin sign-in | Bicep creates the resource group, storage account and Free Static Web App in a US region; the deployment token is stored as a GitHub secret; **a push to `main` deploys automatically** with a smoke test and PR previews; admin can sign in with a personal **and** a work Microsoft account; empty "My games" page is live. |
| **M2** | Games and participants | Admin creates/deletes games with a unique 6-digit code; `.txt` upload and add/delete of participants with distinct-name enforcement; expiry set to 3 days and extendable. |
| **M3** | Player experience | Join with code, pick name, add connection with existing or new topic, see own connections, delete with confirmation; all server-side rules enforced. |
| **M4** | Live updates | Version-based polling: topics and connections appear on other devices and on the big screen within about 2 seconds; backs off in hidden tabs and recovers after network loss. |
| **M5** | Topic management | Admin deletes topics (cascade) and merges topics; admin deletes any connection or participant. |
| **M6** | Timer screen | Admin-controlled timer (default 30 min, server-based so all screens agree), rules text, short URL, game code, QR, dots-only live graph, zero-time notification that does not stop the game. |
| **M7** | Results views | Network graph, top topics, super-connectors, unexpected links, groups and completeness, topic spotlight, connection matrix, timeline replay, summary card; PNG export. |
| **M8** | Hardening and launch | Load test with 50 simulated players, accessibility and projector-contrast pass, error handling, README for admins, final production release. |
| Later | Optional upgrade | Azure Web PubSub push hints for sub-second updates (paid tier needed above 20 connections). |

## 9. Testing strategy
- **Unit tests (Vitest)** for the pure logic: name normalization and de-duplication, connection key building, merge rules, connected-groups calculation, results statistics.
- **API integration tests** against Azurite: permissions (owner-only, delete only by the two people), duplicate rules, cascade deletes, expiry blocking.
- **End-to-end:** `scripts/e2e-api.mjs` drives every API endpoint through the real Azure Functions host (also run in CI); `scripts/simulate.mjs` simulates up to 50 players for the load test. Component tests (Vitest and jsdom) include automated accessibility checks.
- Manual review on a real phone and a projector-sized screen at the end of M3, M6 and M7.

## 10. Security and privacy notes
- Only first/last names and connection topics are stored; no emails or phone numbers of players.
- All authorization is checked in the API; the front end is never trusted.
- Player tokens are scoped to one game and expire with it; the 6-digit code alone only reveals the participant list for that game.
- Rate-limit the join endpoint (guessing 6-digit codes): the Free plan has no built-in rate limiting, so the API keeps a small attempt counter per IP in Table Storage and temporarily blocks repeated wrong codes.
- Game data is removed on manual delete immediately, and automatically 30 days after expiry.

## 11. Risks
- **Free Static Web Apps has no SLA** and its managed Functions can have cold starts (first request after idle takes a few seconds). Acceptable for an event game; open the app a few minutes before a session. Moving to Standard later is a one-click change if needed.
- **Free-plan quotas** (100 GB bandwidth per month, 250 MB app size): polling responses are tiny, so a 50-person game uses a few MB; monitor after launch.
- **Polling feels slightly less instant than push:** about 2 seconds delay; a Web PubSub upgrade is planned as an optional later step.
- **Anyone with a Microsoft account can become an admin** (by design, per the spec); the damage is limited because each admin only sees their own games.
- **Table Storage query limits:** no joins or aggregates; fine for these data sizes because aggregates are computed in memory.
- **Projector readability** depends on real hardware; checked in M6 and M8.
