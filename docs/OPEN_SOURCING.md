# Making the repository public

The repository is **prepared** for publication but still private. Until you flip the switch below, the public pages say
"open source, coming soon" and do not link to the repository. This checklist is for the owner; do the steps in order.

## How the project is framed

These choices follow common practice for small open-source projects and are already reflected in the files:

| Principle | Where |
|-----------|-------|
| **Say what it is and what it is not, up front**: "provided as is, no support, no warranty" in the README, the landing page, the terms and the issue forms | [README.md](../README.md), [SUPPORT.md](../SUPPORT.md), `web/src/site/Landing.tsx` |
| **Issues are the single channel** for bugs, proposals and complaints, through forms that collect what is needed and say that nothing is promised | `.github/ISSUE_TEMPLATE/` |
| **Private channels only where public is dangerous**: security reports (private advisories) and privacy requests (email) never go to public issues | [SECURITY.md](../SECURITY.md), `.github/ISSUE_TEMPLATE/config.yml` |
| **Low maintenance expectations are written down**: best effort, no response times, small focused pull requests, "open an issue first" | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Code of conduct**, so you can moderate without argument | [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) |
| **A clear license** and no surprises in dependencies | `LICENSE` (MIT), [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md), CI check |
| **No personal data or secrets in the repository** | Scrubbed; see step 2 |
| **The hosted service and the code are separate**: the code is free software, the hosted service is a best-effort convenience under its own terms | Terms of service, section 1 |

Using the same file names GitHub looks for (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, issue forms,
a pull request template) makes GitHub show them in the "Community standards" checklist and next to the new-issue button; see
[GitHub's documentation on community health files](https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file).

## 1. Decisions before you publish

1. **License.** The repository has the MIT license (copyright holder: Viktor Tsykunov), chosen for wide adoption: anyone may use, modify and host the code, also in
   closed-source products. If you later want modified hosted copies to publish their changes, you would need a copyleft license
   such as AGPL-3.0; decide before accepting contributions (see [LEGAL_NOTES.md](LEGAL_NOTES.md), section 6). To switch, replace
   `LICENSE` and update the `license` fields in the four `package.json` files, README, CONTRIBUTING, `siteConfig.ts` and
   `scripts/licenses.mjs`.
2. **Employer and ownership.** Confirm that your employer allows you to publish this code, and to run it, if the work was done
   in a way that could make it theirs. Keep written permission if in doubt.
3. **Name.** Check that the name is free to use (see LEGAL_NOTES, section 5).
4. **Operator details.** Fill in `web/src/site/legal.config.json` (operator, contact email, governing law, supervisory authority; the postal
   address is optional). The repository will contain this information, as will the public legal pages.

## 2. Clean the history

The history contains the commit author names and email addresses of everyone who committed (check with
`git log --format='%an <%ae>' | sort -u`). They become public the moment the repository is public and cannot be withdrawn
later. Also check the history for anything that should not be public (for example older versions of files that were scrubbed
later).

**Rewriting or deleting branches is not enough.** Every pull request keeps its commits reachable through a hidden
reference (`refs/pull/<number>/head`) that only GitHub can change, so old commits stay visible on the pull request pages even
after branches are deleted and `main` is rewritten. Removing them means asking GitHub Support, which takes an unknown time.
The reliable way is a new repository, which also leaves the old pull requests, issues and Actions logs behind.

Two options:

- **Recommended: publish a fresh repository with a single starting commit.** Nothing old leaks and the author is whatever you
  choose now. To keep the repository address (and with it every link in the README, the issue forms and `package.json`), put
  the new repository under the old name:

  1. Rename the private repository, for example to `connect-the-dots-archive` (`gh repo rename`), and keep it private.
  2. Create a new, empty, **private** repository with the original name.
  3. Make the single starting commit from a clean clone and push it:

  ```bash
  git clone --no-local . ../connect-the-dots-public
  cd ../connect-the-dots-public
  git checkout --orphan clean && git add -A
  git -c user.name="<public name>" -c user.email="<public email or noreply address>" commit -m "Initial public release"
  git branch -M main
  git remote set-url origin https://github.com/<owner>/<repo>.git   # the NEW empty repository
  git push -u origin main
  ```

  4. Set the secrets and variables (see [DEPLOYMENT.md](DEPLOYMENT.md), section 3) and the labels (`bug`, `enhancement`,
     `feedback`, `needs-triage`; the proposal form applies `enhancement`), apply the settings in section 3 below, and wait for the first pipeline run to be green. The
     Static Web App is deployed with a token and has no repository linked, so nothing needs to be re-linked in Azure.
  5. Make the repository public (section 4), and delete the archived private repository last (the GitHub CLI needs
     `gh auth refresh -s delete_repo` for that).

  Pull requests, issues and the Actions history of the private repository stay behind.
- **Keep the history**, after checking it with a secret scanner (for example `gitleaks detect`) and accepting that the author
  emails are published. If you want to hide the email addresses, use `git filter-repo --mailmap` before publishing.

Either way, run the checks on the final tree:

```bash
npm ci && npm run check && npm run licenses -- --check
git grep -n -i -E "password|secret|token|key" -- ':!*.lock' ':!package-lock.json' | less   # review, do not just trust
```

The secrets (`TOKEN_SIGNING_SECRET`, `CLEANUP_TOKEN`, the deployment token) live only in Azure and in GitHub secrets, never in
the repository. If any secret was ever committed, **rotate it** rather than relying on history cleaning.

## 3. Settings when the repository becomes public

In **Settings** of the new repository:

- **General:** Features: keep Issues on; turn **Wikis, Projects and Discussions off** (one channel, less to watch). Turn on
  "Automatically delete head branches". Optionally set a description, website and topics (for SEO and discovery), for example
  `team-building`, `workshop`, `icebreaker`, `react`, `azure-functions`.
- **Code security:** turn on **Private vulnerability reporting** (required by SECURITY.md), **Dependabot alerts** and security
  updates, **secret scanning** and **push protection**. Optionally add **CodeQL** default setup.
- **Branches / Rulesets** (a ruleset on a private repository needs a paid plan, so create it right after the repository
  is public): protect `main`: require a pull request with **1 approving review from a code owner** (`.github/CODEOWNERS` names
  the maintainer, so every pull request from anyone else needs the maintainer's approval), dismiss stale approvals when new
  commits are pushed, require the status check **Lint, test, build** to pass, require the branch to be up to date, block
  force pushes and deletion. Add the repository admin role as a **bypass actor** so the maintainer can still push small fixes
  directly (a push to `main` deploys automatically).
- **Actions → General:** "Fork pull request workflows from outside collaborators" → **Require approval for all outside
  collaborators**; default workflow permissions → **Read repository contents**.
- **Deployment secrets** are not shared with workflows from forks. The pipeline already skips the deploy job for them
  (`ci-cd.yml`), but keep the approval setting.
- **Labels:** make sure `bug`, `enhancement` (used by the proposal form), `feedback`, `needs-triage` exist (the issue forms
  apply them). `bug` and `enhancement` come with a new repository; create `feedback` and `needs-triage` yourself.
- **Social preview:** upload `web/public/og-image.png`.
- Pin the repository on your profile if you like, and add the **About** link to the live site.

Because PR previews share production data (see [OPERATIONS.md](OPERATIONS.md)), only run previews for pull requests from the
repository itself. Fork pull requests are tested but not deployed, which is already the case.

## 4. Switch the website on

1. In `web/src/site/siteConfig.ts`, set `repo.url` to the final address (it must match the repository you publish) and
   `repo.public` to `true`.
2. Replace the hard-coded repository address elsewhere if the owner or name changed (`git grep vityabool`): README badges,
   `.github/ISSUE_TEMPLATE/config.yml`, SECURITY.md, SUPPORT.md, `package.json` `repository`/`bugs`/`homepage`, structured data
   and `llms.txt` (generated from `siteConfig.ts`).
3. Run `npm run check`, merge to `main`, wait for the pipeline.
4. Check on the live site: the landing page, the footer and the "How to play" page link to the repository, "Report a problem"
   and "Suggest an idea" open the issue forms, and the "coming soon" notes are gone.

## 5. First day

- Open the repository in a private window and look at it as a stranger would (README, license in the sidebar, "Community
  standards" at `/community`).
- Create the first release/tag (`v1.0.0`) with short release notes. Optional, but it gives people something stable to point to.
  The notes are the `1.0.0` section of [CHANGELOG.md](../CHANGELOG.md): create the release in the GitHub form (Releases >
  Draft a new release, tag `v1.0.0`) and paste that section, or use `gh release create v1.0.0 --title v1.0.0 --notes-file <file>`.
- File two or three starter issues labelled `good first issue` or `help wanted` only if you really want help; otherwise say so
  in the README (it already says that outside help is welcome but not expected).
- Announce it where you want to (your own channels). Search engines find the landing page through the sitemap; submit it in
  Google Search Console and Bing Webmaster Tools if you like (needs a verification step with your account, not done here).

## 6. Living with it

- **Triage on your schedule.** The issue forms and SUPPORT.md say there is no response time. A weekly look is plenty. Use
  `needs-triage` to mark what you have not read.
- **Close with kindness and brevity.** "Thanks, not planned" is a legitimate answer; point to the license (fork freely).
- **Never move a security or privacy matter into public.** If someone posts personal data in an issue, edit or delete the
  comment, ask them to use the private channel, and contact GitHub support if it needs to be purged from history.
- **Keep the repository active.** GitHub switches off scheduled workflows in a public repository after 60 days without any
  repository activity. The daily cleanup workflow is one of them, and the privacy policy promises deletion 30 days after a
  game expires. A commit, merged pull request or issue activity counts as activity; look at the Actions tab at least once a
  month and turn the workflow back on if GitHub disabled it.
- **Keep dependencies and the legal pages current.** Dependabot proposes updates; the CI license check blocks anything
  incompatible. Review the legal pages once a year.
- **If you stop maintaining it**, say so in the README and archive the repository; the license lets others carry on.
