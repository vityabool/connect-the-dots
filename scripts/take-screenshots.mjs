#!/usr/bin/env node
/**
 * Takes the screenshots in docs/screenshots from a LOCAL copy of the app with a sample game (phone, facilitator, big screen and
 * all results views). Real browser, real API: nothing is mocked.
 *
 * Prerequisites (see docs/screenshots/README.md for the whole recipe):
 *   - the local API with a sample game:  node scripts/sample-game.mjs --minutes 30      (prints the game id and code)
 *   - the built web app served with a dev sign-in:  npm run build -w web
 *       CTD_DEV_ADMIN=1 CTD_DEV_ADMIN_NAME=jana@example.com node scripts/serve-dist.mjs --port 4173
 *   - puppeteer-core (not a dependency of the project):  npm install --no-save puppeteer-core
 *   - Chrome or Edge; set CHROME_PATH when it is not found automatically
 *
 *   node scripts/take-screenshots.mjs --code 123456 --game <game id> [--out docs/screenshots] [--base http://127.0.0.1:4173]
 *
 * The sample game is changed by the run (one extra connection is added from the phone), so create a fresh one for every run.
 */
/* global document, window -- used inside page.evaluate(), which runs in the browser */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, token, i, all) => {
    if (token.startsWith('--')) pairs.push([token.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const code = args.code;
const gameId = args.game;
const out = args.out ?? 'docs/screenshots';
const base = (args.base ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const api = (args.api ?? 'http://localhost:7072').replace(/\/$/, '');
if (!code || !gameId) {
  console.error('Usage: node scripts/take-screenshots.mjs --code <6-digit code> --game <game id> [--out dir] [--base url]');
  process.exit(1);
}

const { default: puppeteer } = await import('puppeteer-core').catch(() => {
  console.error('puppeteer-core is missing. Install it without saving: npm install --no-save puppeteer-core');
  process.exit(1);
});

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executable = CANDIDATES.find((path) => existsSync(path));
if (!executable) {
  console.error('No Chrome or Edge found. Set CHROME_PATH.');
  process.exit(1);
}

// The browser is started by hand and attached over the debugging port: puppeteer's own launcher does not work with Edge's headless mode.
const port = 9333;
const child = spawn(
  executable,
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ctd-shots-'))}`, 'about:blank'],
  { stdio: 'ignore' },
);
let browser;
for (let i = 0; i < 60 && !browser; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` }).catch(() => undefined);
}
if (!browser) {
  child.kill();
  throw new Error('The browser did not start');
}

mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shot = async (page, name, options = {}) => {
  await page.screenshot({ path: `${out}/${name}.png`, ...options });
  console.log('saved', name);
};
const clickButton = (page, pattern) =>
  page.evaluate((source) => [...document.querySelectorAll('button')].find((b) => new RegExp(source, 'i').test(b.textContent ?? ''))?.click(), pattern.source);
const optionValue = (page, selector, text) =>
  page.evaluate((s, t) => [...document.querySelectorAll(`${s} option`)].find((o) => (o.textContent ?? '').includes(t))?.value, selector, text);

try {
  // A fresh countdown for the Timer screen (the local dev sign-in is the simulation admin).
  const principal = Buffer.from(
    JSON.stringify({ userId: 'simulation-admin', userDetails: 'simulation@example.com', identityProvider: 'aad', userRoles: ['anonymous', 'authenticated'] }),
  ).toString('base64');
  for (const action of ['reset', 'start']) {
    await fetch(`${api}/api/manage/games/${gameId}/timer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ms-client-principal': principal },
      body: JSON.stringify({ action }),
    });
  }

  // ---- phone: landing page, then a player joins, picks a name and adds a connection ----
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto(`${base}/`, { waitUntil: 'networkidle0' });
  await shot(phone, 'mobile-landing');
  await phone.goto(`${base}/join/${code}`, { waitUntil: 'networkidle0' });
  await shot(phone, 'mobile-join');
  await clickButton(phone, /join/);
  await phone.waitForSelector('select');
  await phone.select('select', await optionValue(phone, 'select', 'Anna Novak'));
  await wait(300);
  await shot(phone, 'mobile-pick-name');
  await clickButton(phone, /continue as/);
  await phone.waitForSelector('#other');
  await shot(phone, 'mobile-play');
  await phone.select('#other', await optionValue(phone, '#other', 'Olivia Brown'));
  await phone.waitForSelector('#topic');
  await phone.select('#topic', await optionValue(phone, '#topic', 'Have dogs'));
  await wait(300);
  await shot(phone, 'mobile-add-connection');
  await clickButton(phone, /add connection/);
  await wait(1500);
  await phone.reload({ waitUntil: 'networkidle0' }); // no confirmation message in the picture
  await phone.evaluate(() => [...document.querySelectorAll('h2,h3')].find((h) => /my connections/i.test(h.textContent ?? ''))?.scrollIntoView({ block: 'start' }));
  await wait(300);
  await shot(phone, 'mobile-my-connections');
  await phone.close();

  // ---- desktop: public pages, facilitator, big screen and results ----
  const desktop = { width: 1280, height: 800, deviceScaleFactor: 2 };
  const page = await browser.newPage();
  await page.setViewport(desktop);
  for (const [name, path] of [
    ['landing', '/'],
    ['how-to-play', '/how-to-play'],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
    await shot(page, name);
  }
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle0' });
  await wait(1500);
  await shot(page, 'facilitator-games');
  await page.goto(`${base}/admin/games/${gameId}`, { waitUntil: 'networkidle0' });
  await wait(2000);
  await shot(page, 'facilitator-game');
  for (const [name, heading] of [
    ['facilitator-topics', '^topics'],
    ['facilitator-timer', '^timer'],
    ['facilitator-connections', '^connections'],
  ]) {
    await page.evaluate((source) => {
      const found = [...document.querySelectorAll('h2,h3')].find((e) => new RegExp(source, 'i').test((e.textContent ?? '').trim()));
      if (found) window.scrollTo(0, found.getBoundingClientRect().top + window.scrollY - 24);
    }, heading);
    await wait(300);
    await shot(page, name);
  }
  await page.goto(`${base}/admin/games/${gameId}/screen`, { waitUntil: 'networkidle0' });
  await wait(4500);
  await shot(page, 'timer-screen');
  await page.setViewport({ ...desktop, height: 960 });
  for (const view of ['network', 'topics', 'connectors', 'unexpected', 'groups', 'spotlight', 'matrix', 'replay', 'summary']) {
    await page.goto(`${base}/admin/games/${gameId}/results?view=${view}`, { waitUntil: 'networkidle0' });
    await wait(4500); // the graph settles
    await shot(page, `results-${view}`);
  }
} finally {
  await browser.disconnect();
  child.kill();
}
