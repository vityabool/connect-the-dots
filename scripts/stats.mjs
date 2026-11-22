#!/usr/bin/env node
/**
 * Usage statistics for the operator: how much the site is used and whether games are being played.
 *
 *   npm run stats                 last 30 days
 *   npm run stats -- --days 90    another period (Azure keeps platform metrics for 93 days)
 *   npm run stats -- --json       machine-readable output
 *
 * It uses YOUR logins on this computer: the Azure CLI (`az login`, access to the resource group) and the GitHub CLI
 * (`gh`, as the repository owner). It needs no keys in the repository and changes nothing; it only reads.
 *
 * Privacy: the privacy policy promises no analytics and no tracking, so there are NO unique-visitor numbers and none can
 * be made. What it reads instead:
 *   - Azure platform counters of the Static Web App (requests, API calls, errors, bytes) that the hosting platform keeps anyway;
 *   - COUNTS of rows in the game tables (games, participants, topics, connections) and their dates. It never reads or prints
 *     names, topics, game names, join codes, user ids or addresses;
 *   - GitHub's own traffic figures for the repository (visible to the owner only).
 */
import { execFileSync } from 'node:child_process';
import { TableClient } from '@azure/data-tables';

const RESOURCE_GROUP = 'rg-connect-the-dots';
const STATIC_APP = 'ctd-human-network';
const REPO = 'vityabool/connect-the-dots';
const DAY = 24 * 60 * 60 * 1000;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const days = Math.min(93, Math.max(1, Number(option('--days', '30')) || 30));
const asJson = flag('--json');

const windows = process.platform === 'win32';
function run(command, args, env = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    shell: windows, // az and gh are .cmd files on Windows
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MSYS_NO_PATHCONV: '1', ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
}
const az = (args) => JSON.parse(run('az', [...args, '-o', 'json']));

const report = { generatedAt: new Date().toISOString(), days, notes: [] };
const now = new Date();
// Start at midnight UTC so the daily buckets match calendar days.
const since = new Date(Math.floor((now.getTime() - days * DAY) / DAY) * DAY);

/** Runs one section; a failure in one source does not stop the others. */
async function section(name, fn) {
  try {
    report[name] = await fn();
  } catch (error) {
    report[name] = { error: String(error.stderr || error.message || error).split('\n')[0].slice(0, 200) };
  }
}

// ---------------------------------------------------------------------------------------------------------------- website
await section('website', async () => {
  const app = az(['staticwebapp', 'show', '--name', STATIC_APP, '--resource-group', RESOURCE_GROUP]);
  const metrics = ['SiteHits', 'SiteErrors', 'FunctionHits', 'FunctionErrors', 'BytesSent'];
  const result = az([
    'monitor', 'metrics', 'list', '--resource', app.id, '--metric', ...metrics,
    '--interval', 'P1D', '--aggregation', 'Total',
    '--start-time', since.toISOString(), '--end-time', now.toISOString(),
  ]);
  const perDay = {};
  for (const metric of result.value) {
    for (const series of metric.timeseries) {
      for (const point of series.data) {
        const day = point.timeStamp.slice(0, 10);
        perDay[day] = perDay[day] ?? {};
        perDay[day][metric.name.value] = point.total ?? 0;
      }
    }
  }
  const rows = Object.keys(perDay).sort().map((day) => ({ day, ...perDay[day] }));
  const total = (key) => rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  return {
    perDay: rows,
    totals: Object.fromEntries(metrics.map((key) => [key, total(key)])),
  };
});

// ---------------------------------------------------------------------------------------------------------------- games
await section('games', async () => {
  const account = az(['storage', 'account', 'list', '--resource-group', RESOURCE_GROUP])[0];
  const key = az(['storage', 'account', 'keys', 'list', '--account-name', account.name, '--resource-group', RESOURCE_GROUP])[0].value;
  const connection = `DefaultEndpointsProtocol=https;AccountName=${account.name};AccountKey=${key};EndpointSuffix=core.windows.net`;

  async function read(table, select) {
    const client = TableClient.fromConnectionString(connection, table);
    const rows = [];
    for await (const entity of client.listEntities({ queryOptions: { select } })) rows.push(entity);
    return rows;
  }

  // Only identifiers and dates are selected; nothing that names a person, a game or a topic.
  // The key columns must be selected explicitly, otherwise the table client leaves partitionKey out.
  const [games, participants, topics, connections] = await Promise.all([
    read('Games', ['PartitionKey', 'RowKey', 'createdAt', 'expiresAt']),
    read('Participants', ['PartitionKey', 'RowKey']),
    read('Topics', ['PartitionKey', 'RowKey']),
    read('Connections', ['PartitionKey', 'RowKey', 'createdAt', 'createdBy']),
  ]);

  const byGame = new Map(games.map((g) => [g.partitionKey, { created: String(g.createdAt ?? ''), expires: String(g.expiresAt ?? ''), people: 0, topics: 0, connections: 0, makers: new Set(), first: null, last: null }]));
  for (const p of participants) if (byGame.has(p.partitionKey)) byGame.get(p.partitionKey).people += 1;
  for (const t of topics) if (byGame.has(t.partitionKey)) byGame.get(t.partitionKey).topics += 1;
  for (const c of connections) {
    const game = byGame.get(c.partitionKey);
    if (!game) continue;
    game.connections += 1;
    if (c.createdBy) game.makers.add(String(c.createdBy));
    const at = Date.parse(String(c.createdAt ?? ''));
    if (!Number.isNaN(at)) {
      game.first = game.first === null ? at : Math.min(game.first, at);
      game.last = game.last === null ? at : Math.max(game.last, at);
    }
  }

  const list = [...byGame.values()].sort((a, b) => a.created.localeCompare(b.created));
  const rows = list.map((g, index) => ({
    game: index + 1, // anonymous running number, not an identifier
    created: g.created.slice(0, 16).replace('T', ' '),
    expires: g.expires.slice(0, 10),
    participants: g.people,
    connections: g.connections,
    playersWhoConnected: g.makers.size,
    minutesOfPlay: g.first !== null && g.last !== null ? Math.round((g.last - g.first) / 60000) : 0,
  }));
  const played = rows.filter((row) => row.connections > 0);
  return {
    note: 'Games are deleted 30 days after they expire, so this only covers games still stored.',
    totals: {
      games: rows.length,
      gamesWithConnections: played.length,
      activeNow: list.filter((g) => Date.parse(g.expires) > now.getTime()).length,
      participants: participants.length,
      topics: topics.length,
      connections: connections.length,
      playersWhoConnected: rows.reduce((sum, row) => sum + row.playersWhoConnected, 0),
    },
    rows,
  };
});

// ---------------------------------------------------------------------------------------------------------------- GitHub
await section('github', async () => {
  let token = '';
  try {
    token = run('gh', ['auth', 'token', '--user', REPO.split('/')[0]]).trim();
  } catch {
    // fall back to whatever account gh is using
  }
  const gh = (path) => JSON.parse(run('gh', ['api', path], token ? { GH_TOKEN: token } : {}));
  const repo = gh(`repos/${REPO}`);
  const out = {
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count,
    openIssues: repo.open_issues_count,
  };
  try {
    const views = gh(`repos/${REPO}/traffic/views`);
    const clones = gh(`repos/${REPO}/traffic/clones`);
    out.last14Days = { views: views.count, uniqueVisitors: views.uniques, clones: clones.count, uniqueCloners: clones.uniques };
    out.referrers = gh(`repos/${REPO}/traffic/popular/referrers`).map((r) => `${r.referrer}: ${r.count} views, ${r.uniques} visitors`);
  } catch {
    out.last14Days = 'traffic figures need the repository owner account (gh auth switch --user vityabool)';
  }
  out.releaseDownloads = gh(`repos/${REPO}/releases`).map((r) => ({ tag: r.tag_name, downloads: r.assets.reduce((sum, a) => sum + a.download_count, 0) }));
  const runs = JSON.parse(run('gh', ['run', 'list', '--repo', REPO, '--workflow', 'cleanup.yml', '--limit', '100', '--json', 'event,conclusion,createdAt'], token ? { GH_TOKEN: token } : {}));
  const scheduled = runs.filter((r) => r.event === 'schedule');
  out.dailyCleanup = {
    scheduledRuns: scheduled.length,
    green: scheduled.filter((r) => r.conclusion === 'success').length,
    latest: scheduled[0]?.createdAt ?? null,
  };
  return out;
});

// ---------------------------------------------------------------------------------------------------------------- output
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pad = (value, width) => String(value).padStart(width);
const line = (text = '') => console.log(text);

line(`Connect the Dots: usage statistics, last ${days} days (${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)})`);
line('No analytics exist by design: there are no unique-visitor numbers. Figures below are platform counters and row counts.');

line();
line('WEBSITE (Azure platform counters)');
if (report.website.error) line(`  not available: ${report.website.error}`);
else {
  const t = report.website.totals;
  line(`  Page and asset requests (SiteHits): ${t.SiteHits}   errors: ${t.SiteErrors}`);
  line(`  API calls (FunctionHits):           ${t.FunctionHits}   errors: ${t.FunctionErrors}`);
  line(`  Data sent:                          ${(t.BytesSent / 1e6).toFixed(1)} MB`);
  line('  Notes: SiteHits counts every request (scripts, images, search-engine robots), so one visit is roughly 10 to 20 hits.');
  line('         FunctionHits has a baseline of about 1 a day (the daily cleanup job) plus health checks from deployments;');
  line('         days far above that mean people were playing (players poll the API every 2 seconds).');
  line();
  line('  day         SiteHits  FunctionHits  FnErrors  MB sent');
  for (const row of report.website.perDay) {
    line(`  ${row.day}  ${pad(row.SiteHits ?? 0, 8)}  ${pad(row.FunctionHits ?? 0, 12)}  ${pad(row.FunctionErrors ?? 0, 8)}  ${pad(((row.BytesSent ?? 0) / 1e6).toFixed(1), 7)}`);
  }
}

line();
line('GAMES (counts only, no names)');
if (report.games.error) line(`  not available: ${report.games.error}`);
else {
  const t = report.games.totals;
  line(`  Games stored: ${t.games} (${t.activeNow} still open, ${t.gamesWithConnections} with at least one connection)`);
  line(`  Participants: ${t.participants}   topics: ${t.topics}   connections: ${t.connections}   players who made a connection: ${t.playersWhoConnected}`);
  line(`  ${report.games.note}`);
  line();
  line('  game  created           expires     people  connections  players  minutes');
  for (const row of report.games.rows) {
    line(`  ${pad(row.game, 4)}  ${row.created}  ${row.expires}  ${pad(row.participants, 6)}  ${pad(row.connections, 11)}  ${pad(row.playersWhoConnected, 7)}  ${pad(row.minutesOfPlay, 7)}`);
  }
}

line();
line('REPOSITORY (GitHub)');
if (report.github.error) line(`  not available: ${report.github.error}`);
else {
  const g = report.github;
  line(`  Stars: ${g.stars}   forks: ${g.forks}   watchers: ${g.watchers}   open issues and pull requests: ${g.openIssues}`);
  if (typeof g.last14Days === 'string') line(`  ${g.last14Days}`);
  else {
    line(`  Last 14 days: ${g.last14Days.views} views by ${g.last14Days.uniqueVisitors} visitors, ${g.last14Days.clones} clones by ${g.last14Days.uniqueCloners} people`);
    for (const r of g.referrers) line(`  referrer ${r}`);
  }
  for (const r of g.releaseDownloads) line(`  release ${r.tag}: ${r.downloads} asset downloads (source archives are not counted)`);
  line(`  Daily cleanup job: ${g.dailyCleanup.green} of ${g.dailyCleanup.scheduledRuns} recent scheduled runs green (latest ${g.dailyCleanup.latest})`);
}
