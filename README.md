# Connect the Dots: The Human Network

[![CI/CD](https://github.com/vityabool/connect-the-dots/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/vityabool/connect-the-dots/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A free, web-based team-building game for offsites and workshops. 10 to 50 people in a room talk to each other, discover what
they have in common and record each discovery as a connection between two names. The facilitator projects a live network
graph, a countdown, the rules and a QR code to join.

**Try it:** <https://www.connect-the-dots.top> · **How to play:** [guide](https://www.connect-the-dots.top/how-to-play)

> **Status: provided as is, without support or warranty.**
> This is a small, free, open-source project, maintained on a best-effort basis when time allows.
> **Bug reports, proposals and complaints are welcome as [issues](../../issues/new/choose)**, but a reply, a fix or a deadline
> is not guaranteed. See [SUPPORT.md](SUPPORT.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Security problems go to a
> [private advisory](SECURITY.md), privacy requests by email, never to public issues.

This is a personal project created in my personal capacity. It is not affiliated with or endorsed by Microsoft.

## What it does

1. A **facilitator** signs in with a Microsoft account (personal or work), creates a game (6-digit code), uploads the participant
   list and optional starter topics.
2. **Players** open the link or scan the QR code, enter the code, pick their name and add connections: a person plus a topic
   ("Play tennis"). They only see their own connections. No player accounts.
3. The facilitator shows the **Timer screen** during the game (countdown, rules, join code, live network) and the **results**
   afterwards (nine views, exportable as images). Games close after a few days and are deleted automatically 30 days later.

More in [SPEC.md](SPEC.md) (what it does), [PLAN.md](PLAN.md) (how it is built) and [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)
(for facilitators).

## Privacy and terms

No advertising, no analytics, no third-party scripts, no tracking. Only what is needed to run a game is stored, and it is deleted
automatically. See the [privacy policy](https://www.connect-the-dots.top/privacy) and the
[terms of service](https://www.connect-the-dots.top/terms) of the hosted service; their source is in
`web/src/site`. If you run your own copy, you are responsible for adapting them ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Repository layout

| Folder | Contents |
|--------|----------|
| `web/` | React + Vite + TypeScript front end: the game, the admin pages, the big-screen views and the public pages (built as static HTML for search engines) |
| `api/` | Azure Functions (TypeScript) API on Azure Table Storage, bundled with esbuild into `api/dist` |
| `shared/` | Pure TypeScript logic and types used by both (name normalization, connection keys, groups, statistics) |
| `infra/` | Bicep template and script for the Azure resources |
| `scripts/` | Simulation and load test, API end-to-end check, production-build preview, brand assets, contrast check |
| `docs/` | Guides: [facilitators](docs/ADMIN_GUIDE.md), [deployment](docs/DEPLOYMENT.md), [operations](docs/OPERATIONS.md), [accessibility](docs/ACCESSIBILITY.md), [legal notes](docs/LEGAL_NOTES.md), [open-sourcing](docs/OPEN_SOURCING.md) |
| `.github/` | CI/CD, the daily cleanup job, issue forms and pull request template |

## Getting started

Requires Node.js 20 or newer (22 recommended) and npm.

```bash
npm install
npm run check      # lint + type-check + tests + build
```

Run it locally with three terminals (copy `api/local.settings.json.example` to `api/local.settings.json` first):

```bash
npm run dev:storage                # Azurite, the local Table Storage emulator
npm run dev:api                    # Azure Functions on http://localhost:7072
CTD_DEV_ADMIN=1 npm run dev:web    # Vite on http://localhost:5173 (CTD_DEV_ADMIN=1 skips the Microsoft sign-in locally)
```

Fill a game with simulated players: `node scripts/simulate.mjs --players 24 --connections 60`.

| Command | What it does |
|---------|--------------|
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks for the whole repo |
| `npm test` | Unit tests (Vitest), including accessibility checks and search-engine metadata checks |
| `npm run test:integration -w api` | Storage tests against Azurite (start `dev:storage` first) |
| `npm run e2e -w api` | Drives every API endpoint through the real Functions host (start `dev:storage` and `dev:api` first) |
| `npm run build` | Production builds; the web build also creates the static public pages, sitemap and robots.txt |
| `npm run preview:prod` | Serves the production build with the real security headers |
| `npm run check:site` | Lists the legal details still to fill in before the public pages are promoted |

## Hosting

The reference deployment runs on free tiers: Azure Static Web Apps (Free) with managed Functions and Azure Table Storage,
deployed by GitHub Actions on every push to `main`. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) explains how to run your own copy.

### Before you host your own copy

- **The admin API trusts the sign-in header.** The facilitator endpoints (`/api/manage/*`) identify the signed-in user from the
  `x-ms-client-principal` header, which Azure Static Web Apps sets after its own sign-in and route rules
  (`web/public/staticwebapp.config.json`). The API does no sign-in of its own. If you run the Functions app anywhere
  else, or put another proxy in front of it, anyone who can reach it can send that header and act as any admin. Keep the Functions
  app reachable only through Static Web Apps, or replace `api/src/auth.ts` with real token validation.
- `CTD_DEV_ADMIN=1` and the `scripts/` simulations pretend to be signed in with that header. They are for a **local** API only.
- Set `TOKEN_SIGNING_SECRET` to a long random value (for example `openssl rand -base64 48`). The player endpoints refuse to work
  with a secret shorter than 32 characters. Never reuse the value from `api/local.settings.json.example`.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. In short: open an issue for
anything bigger than a small fix, keep changes small and tested, never include personal data.

## License

[MIT License](LICENSE). The license covers the code; it gives no right to the data stored in the hosted
service. Third-party components and their licenses are listed in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
