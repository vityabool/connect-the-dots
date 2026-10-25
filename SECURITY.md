# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose
**Report a vulnerability** (direct link: [new private advisory](../../security/advisories/new)). If you cannot use GitHub,
write to the contact address in the [privacy policy](https://www.connect-the-dots.top/privacy#contact);
the same address is published in `/.well-known/security.txt` once it is configured.

Please include what you found, how to reproduce it and what you think the impact is. Do not include real personal data.

## What to expect

This is a free project maintained on a best-effort basis, provided as is without warranty or service level.

- We try to acknowledge reports within a few weeks and to fix confirmed, serious problems in the hosted service as soon as
  reasonably possible, but we **cannot promise** response or fix times.
- There is **no bug bounty**.
- Please give us reasonable time to fix a problem before you disclose it publicly. We are happy to credit you if you wish.

## Supported versions

Only the latest version on the `main` branch (which is also what runs the hosted service) is supported. If you run your own
copy, keep it up to date.

## Scope

In scope: this repository's code and the hosted service at the address in the README.

Out of scope: denial-of-service or load testing against the hosted service (needs written permission), social engineering,
physical attacks, and problems in third-party services we depend on (Microsoft Azure, GitHub), which should be reported
to those providers.

## Good-faith research

If you act in good faith, stay within scope, avoid accessing other people's data (use games you created yourself), and report
privately, we will not take legal action against you for your research.

## For people running their own copy

Keep secrets (`TABLES_CONNECTION_STRING`, `TOKEN_SIGNING_SECRET`, `CLEANUP_TOKEN`) out of the repository, rotate them if they
leak, and review [docs/OPERATIONS.md](docs/OPERATIONS.md). The code applies a strict content security policy, signed player
sessions and rate limiting; see the privacy policy for the data it stores.
