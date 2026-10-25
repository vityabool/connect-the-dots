# Run your own copy

Connect the Dots is open source, so you can run your own copy. This guide describes the setup of the reference deployment:
Azure Static Web Apps (Free plan) with managed Azure Functions and Azure Table Storage, deployed by GitHub Actions. Everything
fits in free tiers; the only cost is a few cents of storage transactions per game.

> The project is provided **as is, without support or warranty**. This guide is a starting point, not a service. See
> [SUPPORT.md](../SUPPORT.md).

**If you run a copy for other people, you become the operator of a service that processes personal data** (participant names).
You must replace the operator details, the privacy policy and the terms with your own (section 5) and take responsibility for
them. [LEGAL_NOTES.md](LEGAL_NOTES.md) explains what the texts assume.

## 1. What you need

- An Azure subscription and the [Azure CLI](https://learn.microsoft.com/cli/azure/) (`az login`).
- A GitHub account (for the code and the deployment pipeline) and the [GitHub CLI](https://cli.github.com/) (`gh`), optional.
- Node.js 20 or newer for local work.

## 2. Create the Azure resources

```bash
az login
az account set --subscription "<your subscription>"
infra/deploy.sh rg-connect-the-dots eastus2      # resource group name and region (a region supported by Static Web Apps Free)
```

`infra/deploy.sh` (it uses `infra/main.bicep`) creates a resource group, a storage account with the game tables and a Static Web App
(Free plan). It generates the secrets `TOKEN_SIGNING_SECRET` (signs player sessions) and `CLEANUP_TOKEN` (protects the daily
cleanup job) and stores them as application settings of the Static Web App. Running it again keeps existing secrets. Change
the app name `ctd-human-network` in `infra/main.bicep` and `infra/deploy.sh` if you want your own.

The script prints the web address (host name) of your Static Web App.

## 3. Connect GitHub

Fork the repository, then set:

| What | Name | Value |
|------|------|-------|
| Repository secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token: `az staticwebapp secrets list --name <app> --resource-group <rg> --query properties.apiKey -o tsv` |
| Repository secret | `CLEANUP_TOKEN` | The same value as the app setting `CLEANUP_TOKEN` (`az staticwebapp appsettings list ...`) |
| Repository variable | `SWA_URL` | `https://<your host name>` (no trailing slash) |

```bash
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
gh secret set CLEANUP_TOKEN
gh variable set SWA_URL --body "https://<your host name>"
```

Pushing to `main` now runs `.github/workflows/ci-cd.yml`: lint, type-check, tests, build, API end-to-end checks, deploy and a
smoke test. Pull requests get a temporary preview (previews share your production data). The workflow
`.github/workflows/cleanup.yml` calls the cleanup endpoint every day; check that its first run is green.

## 4. Sign-in for facilitators

The facilitator area uses the preconfigured Microsoft sign-in of Static Web Apps, which accepts personal and work accounts and
needs no setup. To restrict who can sign in, register a custom Microsoft Entra provider (needs the Standard plan) as described
in the [Static Web Apps documentation](https://learn.microsoft.com/azure/static-web-apps/authentication-custom).

## 5. Make the pages yours

The public pages (landing page, how to play, privacy policy, terms) are built as static HTML. Before you share the address:

1. Edit `web/src/site/legal.config.json`: operator name, a contact email, optionally a postal address, governing law, and the competent data
   protection authority. Run `npm run check:site` to see what is missing; empty values show a yellow "to be completed" marker
   on the pages and the build prints a warning.
2. Edit `web/src/site/siteConfig.ts`: `defaultUrl` (your address), `repo.url` and `repo.public`, and the hosting region text. If
   you host somewhere else than Azure East US 2, update the **privacy policy** (storage location, transfers, processors).
3. Replace the hard-coded production address in `README.md`, `SUPPORT.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and
   `.github/ISSUE_TEMPLATE/config.yml` with yours.
4. Have the privacy policy and the terms **reviewed for your situation** (see [LEGAL_NOTES.md](LEGAL_NOTES.md)). The texts that
   ship with the repository describe the reference deployment and its operator; they are not a substitute for legal advice.
5. Set `SITE_URL` (the workflow does it from `SWA_URL`) so canonical links, the sitemap and the social preview use your address.

## 6. Check it

- `https://<host>/api/health` answers `{"status":"ok"}`.
- `https://<host>/` shows the landing page; `/sitemap.xml` and `/robots.txt` exist.
- Sign in at `/admin`, create a game, join from a phone, delete the game.
- Actions tab: the cleanup workflow ran green.

## Limits and costs

The Free plan has no service level, bandwidth is limited, and the first request after a quiet period can take a few seconds. The
limits of the game itself (participants, topics, games per facilitator) are in `shared/src/types.ts`. See
[OPERATIONS.md](OPERATIONS.md) for capacity numbers, rollback and troubleshooting.

## Using a different cloud

The API talks to storage through a small interface (`api/src/storage/tables.ts`), so another database can be added, but it
needs real work: the Azure Functions, the Static Web Apps sign-in header and the Bicep template are specific to Azure.

## License reminder

The code is licensed under the MIT License ([LICENSE](../LICENSE)). You may use, modify and redistribute it, including in
closed-source products. Keep the license and copyright notice in all copies.
