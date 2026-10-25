# Contributing

Thank you for your interest! Connect the Dots is a small, free, open-source project. Please read this short guide before
you spend time on a contribution.

## The expectations, honestly

- The project is provided **as is, without support or warranty**, and maintained **when time allows**.
- **Issues** are the place for bug reports, proposals and complaints (use the templates). They are read when time allows; a
  reply, a fix or a deadline is **not guaranteed**.
- **Pull requests** are welcome, but there is no promise that they will be reviewed quickly or accepted. The maintainer
  approves every pull request before it is merged. A short
  explanation will be given when a change is declined. To avoid wasted work, **open an issue first** for anything bigger than
  a small fix, and wait for a reaction before you start.
- The project has a clear scope (a simple, private, mobile-friendly team game that works on free hosting). Features that
  need accounts for players, tracking, paid services or large changes of the data model are unlikely to be accepted.

## Good first contributions

- Fix a bug with a test that shows it.
- Improve wording in the guide, the landing page or the legal pages (legal changes are reviewed carefully).
- Accessibility and mobile improvements.
- Translations: all texts of the game are in `web/src/strings.ts` and the page components of `web/src/site`; ask in an issue
  before starting a translation so we can agree how to switch languages.

## Setting up

You need Node.js 20 or newer and npm.

```bash
git clone <your fork>
cd connect-the-dots
npm install
npm run check          # lint + type-check + tests + build; must pass before you open a pull request
```

To run the game on your computer you need three terminals (Azurite is a local storage emulator):

```bash
npm run dev:storage
npm run dev:api
CTD_DEV_ADMIN=1 npm run dev:web
```

The [README](README.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md) explain the project layout, the scripts and the
end-to-end checks (`npm run e2e -w api`, `node scripts/simulate.mjs`).

## Making a change

1. Fork the repository and create a branch from `main`.
2. Keep the change **small and focused**. One topic per pull request.
3. Add or update **tests**. Bug fixes should come with a test that fails without the fix.
4. Follow the existing style (TypeScript strict mode, ESLint, the surrounding code's comments and naming). All visible text
   goes into `web/src/strings.ts` (or the page components for the public pages).
5. Run `npm run check`. For changes to the API, also run the end-to-end script.
6. Open a pull request and fill in the template.

### Rules that protect people

- **No personal data**, real names of participants or secrets anywhere: code, tests, screenshots, logs. Use made-up data.
- **No tracking, advertising or third-party scripts.** The privacy promises on the site must stay true; a change that adds
  data collection must update the privacy policy in the same pull request.
- Keep the player experience **account-free** and the facilitator view **private to its owner**.

## License of contributions

By contributing you agree that your contribution is released under the project's license, the
[MIT License](LICENSE) (inbound = outbound). You keep the copyright of your work.

## Conduct

Be kind and professional. See the [Code of Conduct](CODE_OF_CONDUCT.md).
