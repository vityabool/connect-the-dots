# Operations guide

How the system is deployed, run and checked. For the facilitator's guide see [ADMIN_GUIDE.md](ADMIN_GUIDE.md).

## What runs where

| Piece | Where | Notes |
|-------|-------|-------|
| Web app + API | Azure Static Web Apps (Free plan) `ctd-human-network`, resource group `rg-connect-the-dots`, East US 2 | Managed Azure Functions (Node 20) serve `/api/*` |
| Data | Storage account in the same resource group, Table Storage (tables `Games`, `GameCodes`, `OwnerGames`, `Participants`, `Topics`, `Connections`, `RateLimits`) | Defined in `infra/main.bicep` |
| Production URL | https://www.connect-the-dots.top | Custom domain on the Static Web App (free managed certificate). Registration and DNS are at GoDaddy: `www` is a CNAME to the `*.azurestaticapps.net` host, and the bare domain is a GoDaddy 301 forward to `https://www.connect-the-dots.top`. The original `*.azurestaticapps.net` address still works |
| Admin sign-in | Static Web Apps built-in Microsoft provider (personal and work accounts) | GitHub sign-in is blocked by a route rule |
| Secrets | Static Web App application settings: `TABLES_CONNECTION_STRING`, `TOKEN_SIGNING_SECRET`, `CLEANUP_TOKEN` | Never in the repo |
| Public address | Application setting `PUBLIC_ORIGIN` (`https://www.connect-the-dots.top`) | The short links from is.gd point to it; is.gd refuses `*.azurestaticapps.net`. Set in `infra/main.bicep` |

## Delivery

- Every push to `main` runs `.github/workflows/ci-cd.yml`: lint, type-check, unit tests, **storage integration tests against the Azurite emulator**, build, **end-to-end checks of every API endpoint through the real Functions host** (`scripts/e2e-api.mjs`), then deploy to Azure, then a smoke test of the home page and `/api/health`. A failing step stops the pipeline, so a broken commit is not deployed.
- A pull request gets a temporary **preview site** (removed when the PR closes; up to 3 at once). **Previews share the production data**, so delete test games when done.
- **Rollback:** revert the bad commit (or re-run the workflow on the last good commit). The pipeline redeploys in about 3 minutes.
- Repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` is the deployment token; repository variable `SWA_URL` is used by the smoke test. To rotate the token: reset it in the Azure portal (Static Web App > Manage deployment token), then `gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN`.
- Infrastructure is code: `infra/main.bicep` and `infra/deploy.sh` (re-runnable; keeps the existing signing secret).

## Checking health

- `GET /api/health` returns `{"status":"ok"}`.
- Azure portal: Static Web App > Functions / Monitoring; Storage account > Insights.
- After a deployment: open the site, sign in at `/admin`, create a game, join from a phone with the code, delete the game.

## Data retention (daily cleanup)

- Expired games are closed to players straight away but stay in storage for 30 days, so the facilitator can still look at the results. After that the daily job deletes the game with its participants, topics and connections, plus rate-limit counters older than a day and index rows that point to games that no longer exist (`api/src/services/cleanup.ts`).
- Managed Functions have no timer trigger, so `.github/workflows/cleanup.yml` calls `POST /api/maintenance/cleanup` every day at 03:17 UTC with the header `x-cleanup-token`. The endpoint answers 404 unless the app setting `CLEANUP_TOKEN` exists, and 401 without the matching token. The same value is stored as the repository secret `CLEANUP_TOKEN` (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- **Watch the workflow.** If it stops running (disabled after 60 days without repository activity, a rotated token, a changed `SWA_URL`), expired games are not deleted and the retention promise in the privacy policy is broken. A failed run is visible in the Actions tab; you can also run it by hand with "Run workflow".

## Capacity and load test

`node scripts/simulate.mjs --players 50 --connections 150 --poll-seconds 30` simulates a full room against a **local** API (it needs the sign-in header that only the platform sets in production). Result of the last run (50 players, 180 connections, every player polling every 2 s for 30 s, local emulator):

| Call | Average | 95th percentile | Max |
|------|---------|-----------------|-----|
| Join with code | 296 ms | 374 ms | 375 ms |
| Pick name | 123 ms | 175 ms | 189 ms |
| Add connection | 123 ms | 183 ms | 191 ms |
| Poll (changed / unchanged) | 12 ms | 18 ms | 32 ms |

No errors. Real Azure adds network latency, but the numbers show the application code is not a bottleneck: 50 players polling every 2 seconds is about 25 small requests per second.

**Against real Azure Table Storage.** The same checks were also run once against a temporary storage account in East US 2 (deleted afterwards): the storage integration tests, the 53 API end-to-end checks and the 50-player load test all passed with 0 errors. Measured from a PC outside Azure (so every call includes the internet round trip, about 0.2 to 0.4 s), a poll took about 380 ms, adding a connection about 650 ms and joining about 950 ms. In production the Functions run next to the storage, so only the visitor's own network delay remains.

Built-in limits: 50 games per admin, 200 participants and 200 topics per game, names up to 100 characters (topics 60), expiry at most 30 days ahead, timer 1 to 240 minutes.

## Cost

Everything runs on free tiers. The only charge is Table Storage transactions: a 50-person game produces a few tens of thousands of requests, which is a few cents or less. Static Web Apps Free has a bandwidth cap (100 GB per month) that a game of this size does not approach.

## Security notes

- Admin pages and `/api/manage/*` require a signed-in user (enforced by Static Web Apps and again in every API call). Each admin only sees their own games; anything else answers "not found".
- Players have no accounts: the 6-digit code gives a signed token (HMAC-SHA256) bound to one game; wrong codes are rate-limited per client address (10 per 10 minutes).
- Response headers (`staticwebapp.config.json`): a strict Content Security Policy, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. They were checked against the production build with `npm run preview:prod`.
- Rate limiting uses the client address from the `x-forwarded-for` header set by the platform. It slows down guessing of game codes; it is not a hard guarantee against a determined attacker who can vary that header.
- `TOKEN_SIGNING_SECRET` must be at least 32 characters (the player endpoints refuse to work with a shorter one); `infra/deploy.sh` generates 64. Rotating it signs every player out (they just join again); admin sign-in is not affected.
- Personal data stored: participant names and connection topics only. Delete a game to remove them.

## Known gaps and ideas

- **Updates arrive by polling** (about 2 seconds). Azure Web PubSub could make them instant, but its free tier is limited to 20 connections.
- Only English is available; all texts are in `web/src/strings.ts`.
- The Free plan has no SLA and the first request after a quiet period can take a few seconds.

## Local development

```bash
npm install
npm run check            # lint, type-check, tests, build
npm run dev:storage      # Azurite (local Table Storage)
npm run dev:api          # Functions host on http://localhost:7072
CTD_DEV_ADMIN=1 npm run dev:web   # Vite on http://localhost:5173, pretends to be signed in as the simulation admin
node scripts/simulate.mjs --players 24 --connections 60   # fills a game with simulated players
npm run test:integration -w api   # storage tests against Azurite (start dev:storage first)
npm run e2e -w api                # every API endpoint through the real Functions host (start dev:storage and dev:api first)
npm run preview:prod     # serve the production build with the real security headers
```
