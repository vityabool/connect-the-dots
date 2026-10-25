#!/usr/bin/env node
/**
 * Fills a game with simulated players through the real HTTP API, and measures how the API copes.
 * Also used as a load test: many players join, connect and poll at the same time.
 *
 * It creates the game as an admin, which needs the Static Web Apps sign-in header, so it works against a
 * LOCAL API (`npm run dev:api` on port 7072) - not against production, where only a real sign-in works.
 *
 * Usage:
 *   node scripts/simulate.mjs [--base http://localhost:7072] [--players 50] [--connections 120]
 *                             [--poll-seconds 0] [--name "Simulated game"] [--keep]
 *
 *   --players         number of simulated people (default 20)
 *   --connections     connections to create in total (default players * 2)
 *   --poll-seconds    after connecting, every player polls /api/play/state for this long (default 0)
 *   --keep            leave the game in place (default: delete it when the run ends, unless --poll-seconds is 0)
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, token, i, all) => {
    if (token.startsWith('--')) pairs.push([token.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
    return pairs;
  }, []),
);

const base = String(args.base ?? 'http://localhost:7072').replace(/\/$/, '');
const playerCount = Number(args.players ?? 20);
const connectionTarget = Number(args.connections ?? playerCount * 2);
const pollSeconds = Number(args['poll-seconds'] ?? 0);
const gameName = String(args.name ?? 'Simulated game');
const keep = args.keep === true;

const FIRST = ['Anna', 'Ivan', 'Olena', 'Maksym', 'Iryna', 'Taras', 'Sofiia', 'Andrii', 'Kateryna', 'Dmytro', 'Natalia', 'Oleh', 'Yulia', 'Bohdan', 'Mariia', 'Serhii', 'Oksana', 'Vitalii', 'Halyna', 'Pavlo'];
const LAST = ['Koval', 'Petrenko', 'Shevchenko', 'Bondar', 'Melnyk', 'Tkachenko', 'Kravchenko', 'Boyko', 'Lysenko', 'Moroz'];
const TOPICS = ['Have dogs', 'Play tennis', 'Play an instrument', 'Grew up in the same country', 'Visited the same unusual place', 'Began as a software engineer', 'Share a hobby', 'Changed industries', 'Love hiking', 'Read the same book'];

// With --long-names every name is long (made-up names), to check that nothing gets cut off on screens and exports.
const LONG = [
  'Bartholomew Vandenberghe-Lindqvist', 'Prabodh Reddy Kommidi', 'Luis Orozco Martinez', 'Aniruddha Khandge', 'Viswanath Ramanan',
  'Konstantinos Papadopoulos', 'Oluwaseun Adebayo-Williams', 'Maximiliane von Hohenzollern', 'Jean-Baptiste Delacroix', 'Wojciech Szczepanski',
  'Chukwuemeka Nwachukwu', 'Siddharth Venkataraman', 'Guadalupe Hernandez Ruiz', 'Anastasiia Oleksandrivna Kovalenko', 'Thiago Albuquerque Neto',
  'Ingibjorg Sigurdardottir', 'Dmitrii Rozhdestvensky', 'Mohammed Abdelrahman', 'Sofia Montenegro-Castillo', 'Raphael Oyelaran',
  'Yulia Shevchenko-Boyko', 'Zhang Wei Ming', 'Adina Samoila', 'Michael Luk', 'CY Zhang', 'Ketan Lamba',
];
const names = args['long-names'] ? LONG.slice(0, playerCount) : Array.from({ length: playerCount }, (_, i) => `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}${i >= FIRST.length * LAST.length ? ` ${i}` : ''}`);

const principal = Buffer.from(
  JSON.stringify({ userId: 'simulation-admin', userDetails: 'simulation@example.com', identityProvider: 'aad', userRoles: ['anonymous', 'authenticated'] }),
).toString('base64');

const timings = { join: [], identity: [], connect: [], poll: [], pollUnchanged: [] };
let errors = 0;

async function call(path, { method = 'GET', body, headers = {}, bucket } = {}) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const elapsed = performance.now() - started;
  if (bucket) timings[bucket].push(elapsed);
  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  return { status: response.status, json, elapsed };
}

const admin = { 'x-ms-client-principal': principal };

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function report(label, values) {
  if (values.length === 0) return;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  console.log(
    `  ${label.padEnd(16)} n=${String(values.length).padEnd(5)} avg=${avg.toFixed(0).padStart(4)}ms  p50=${percentile(values, 50).toFixed(0).padStart(4)}ms  p95=${percentile(values, 95).toFixed(0).padStart(4)}ms  max=${Math.max(...values).toFixed(0).padStart(4)}ms`,
  );
}

async function main() {
  console.log(`Simulating ${playerCount} players, ${connectionTarget} connections against ${base}`);

  const created = await call('/api/manage/games', { method: 'POST', headers: admin, body: { name: gameName } });
  if (created.status !== 200) throw new Error(`Could not create the game (${created.status}): ${JSON.stringify(created.json)}`);
  const game = created.json;
  console.log(`Game "${game.name}"  code ${game.code}  id ${game.id}`);

  const added = await call(`/api/manage/games/${game.id}/participants`, { method: 'POST', headers: admin, body: { text: names.join('\n') } });
  if (added.json.added.length !== playerCount) throw new Error(`Expected ${playerCount} participants, got ${added.json.added.length}`);
  await call(`/api/manage/games/${game.id}/topics`, { method: 'POST', headers: admin, body: { text: TOPICS.join('\n') } });

  // Everyone joins at the same time, like a room scanning the QR code.
  const players = await Promise.all(
    added.json.added.map(async (participant) => {
      const joined = await call('/api/play/join', { method: 'POST', body: { code: game.code }, bucket: 'join', headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
      if (joined.status !== 200) throw new Error(`join failed: ${joined.status} ${JSON.stringify(joined.json)}`);
      const picked = await call('/api/play/identity', { method: 'POST', body: { participantId: participant.id }, headers: { 'x-player-token': joined.json.token }, bucket: 'identity' });
      if (picked.status !== 200) throw new Error(`identity failed: ${picked.status}`);
      return { ...participant, token: picked.json.token, version: undefined };
    }),
  );
  console.log(`${players.length} players joined and picked their names`);

  const state = await call('/api/play/state', { headers: { 'x-player-token': players[0].token } });
  const topicIds = state.json.topics.map((t) => t.id);

  // Everyone makes connections at the same time.
  let made = 0;
  let started = 0;
  let duplicates = 0;
  const attempts = connectionTarget * 3;
  const queue = Array.from({ length: attempts }, () => {
    const a = Math.floor(Math.random() * players.length);
    let b = Math.floor(Math.random() * players.length);
    if (b === a) b = (b + 1) % players.length;
    return { from: players[a], to: players[b], topicId: topicIds[Math.floor(Math.random() * topicIds.length)] };
  });
  const workers = Array.from({ length: Math.min(25, players.length) }, async () => {
    while (started < connectionTarget && queue.length > 0) {
      const job = queue.pop();
      started += 1;
      const result = await call('/api/play/connections', { method: 'POST', headers: { 'x-player-token': job.from.token }, body: { otherId: job.to.id, topicId: job.topicId }, bucket: 'connect' });
      if (result.status === 200) made += 1;
      else if (result.status === 409) {
        duplicates += 1;
        started -= 1; // a duplicate does not count: try another pair
      }
      else {
        errors += 1;
        console.log(`  unexpected ${result.status}: ${JSON.stringify(result.json)}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`${made} connections created (${duplicates} duplicates rejected, as designed)`);

  if (pollSeconds > 0) {
    console.log(`All players poll for ${pollSeconds}s while a new connection is added every second...`);
    const end = Date.now() + pollSeconds * 1000;
    const pollers = players.map(async (player) => {
      // Spread the first poll over two seconds, as real phones would.
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000));
      while (Date.now() < end) {
        const url = player.version === undefined ? '/api/play/state' : `/api/play/state?since=${player.version}`;
        const result = await call(url, { headers: { 'x-player-token': player.token }, bucket: player.version === undefined ? 'poll' : 'pollUnchanged' });
        if (result.status !== 200) {
          errors += 1;
          console.log(`  poll failed: ${result.status}`);
        } else if (result.json.unchanged) {
          player.version = result.json.version;
        } else {
          player.version = result.json.game.version;
          timings.poll.push(result.elapsed);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    });
    const writer = (async () => {
      while (Date.now() < end) {
        const a = players[Math.floor(Math.random() * players.length)];
        const b = players[Math.floor(Math.random() * players.length)];
        if (a !== b) {
          await call('/api/play/connections', { method: 'POST', headers: { 'x-player-token': a.token }, body: { otherId: b.id, topicId: topicIds[Math.floor(Math.random() * topicIds.length)] }, bucket: 'connect' });
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    })();
    await Promise.all([...pollers, writer]);
  }

  const results = await call(`/api/manage/games/${game.id}`, { headers: admin });
  console.log(`\nGame now has ${results.json.participants.length} people, ${results.json.connections.length} connections, ${results.json.topics.length} topics\n`);

  console.log('Latency');
  report('join', timings.join);
  report('pick name', timings.identity);
  report('add connection', timings.connect);
  report('state (full)', timings.poll);
  report('state (unchanged)', timings.pollUnchanged);
  console.log(`\nErrors: ${errors}`);

  if (keep || pollSeconds === 0) {
    console.log(`\nGame kept. Join code ${game.code}; screen: /admin/games/${game.id}/screen`);
  } else {
    await call(`/api/manage/games/${game.id}`, { method: 'DELETE', headers: admin });
    console.log('Game deleted.');
  }
  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
