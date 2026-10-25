#!/usr/bin/env node
/**
 * Creates a small, realistic sample game through the real HTTP API: 10 people, 10 topics and connections between people who
 * really share an interest, so that nobody is left alone. Used to take screenshots for the documentation and the website.
 *
 * It creates the game as the same local "simulation admin" that `CTD_DEV_ADMIN=1 npm run dev:web` signs in as, so the game shows
 * up in the facilitator pages of the local app. It needs the Static Web Apps sign-in header, so it works against a LOCAL API
 * (`npm run dev:api` on port 7072), not against production.
 *
 *   node scripts/sample-game.mjs [--base http://localhost:7072] [--name "Prague offsite"] [--minutes 30]   (with --minutes the timer is set and started)
 *
 * Prints the game id and join code as JSON on the last line.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, token, i, all) => {
    if (token.startsWith('--')) pairs.push([token.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
    return pairs;
  }, []),
);
const base = String(args.base ?? 'http://localhost:7072').replace(/\/$/, '');
const gameName = String(args.name ?? 'Prague offsite');

const TOPICS = {
  tennis: '🎾 Play tennis',
  dogs: '🐕 Have dogs',
  japan: '✈️ Visited Japan',
  guitar: '🎸 Play guitar',
  halfMarathon: '🏃 Run a half-marathon',
  minecraft: '🎮 Play Minecraft',
  skiing: '⛷️ Enjoy skiing',
  french: '🗣️ Speak French',
  pineapple: '🍕 Love pineapple on pizza',
  electric: '🚗 Drive electric cars',
};

/** Who really has which interest. Connections are only made between people who share the topic. */
const PEOPLE = {
  'Anna Novak': ['tennis', 'dogs', 'skiing', 'french'],
  'Tomáš Dvořák': ['skiing', 'guitar', 'halfMarathon', 'electric'],
  'Maria Garcia': ['tennis', 'dogs', 'french', 'pineapple'],
  'James Wilson': ['guitar', 'minecraft', 'electric', 'tennis'],
  'Priya Sharma': ['japan', 'halfMarathon', 'pineapple', 'dogs'],
  'Lukas Schneider': ['skiing', 'electric', 'minecraft', 'french'],
  'Sofia Rossi': ['pineapple', 'french', 'japan', 'guitar'],
  'Kenji Tanaka': ['japan', 'minecraft', 'halfMarathon', 'electric'],
  'Olivia Brown': ['dogs', 'guitar', 'skiing', 'japan'],
  'Mateo Fernandez': ['tennis', 'halfMarathon', 'pineapple', 'minecraft'],
};

const principal = Buffer.from(
  JSON.stringify({ userId: 'simulation-admin', userDetails: 'simulation@example.com', identityProvider: 'aad', userRoles: ['anonymous', 'authenticated'] }),
).toString('base64');
const admin = { 'x-ms-client-principal': principal };

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : undefined };
}

async function expectOk(promise, what) {
  const result = await promise;
  if (result.status !== 200) throw new Error(`${what} failed (${result.status}): ${JSON.stringify(result.json)}`);
  return result.json;
}

async function main() {
  const names = Object.keys(PEOPLE);
  const game = await expectOk(call('/api/manage/games', { method: 'POST', headers: admin, body: { name: gameName } }), 'create game');
  const added = await expectOk(call(`/api/manage/games/${game.id}/participants`, { method: 'POST', headers: admin, body: { text: names.join('\n') } }), 'add participants');
  // The ten topics are the default topics of every new game: nothing to add.

  const state = await expectOk(call(`/api/manage/games/${game.id}`, { headers: admin }), 'read game');
  const topicId = Object.fromEntries(Object.entries(TOPICS).map(([key, label]) => [key, state.topics.find((t) => t.name === label)?.id]));
  for (const [key, id] of Object.entries(topicId)) if (!id) throw new Error(`topic "${key}" was not created`);
  const personId = Object.fromEntries(added.added.map((p) => [p.name, p.id]));

  const players = {};
  for (const [index, name] of names.entries()) {
    const joined = await expectOk(call('/api/play/join', { method: 'POST', body: { code: game.code }, headers: { 'x-forwarded-for': `10.1.0.${index + 1}` } }), 'join');
    const picked = await expectOk(call('/api/play/identity', { method: 'POST', body: { participantId: personId[name] }, headers: { 'x-player-token': joined.token } }), 'pick name');
    players[name] = picked.token;
  }

  // For every topic, chain the people who share it (A-B, B-C, ...). Each connection is created by the first person of the pair.
  const links = [];
  for (const key of Object.keys(TOPICS)) {
    const group = names.filter((name) => PEOPLE[name].includes(key));
    for (let i = 0; i + 1 < group.length; i += 1) links.push([group[i], group[i + 1], key]);
  }
  // A few topics were found only once or twice: they show up under "Unexpected links" in the results.
  const RARE = { minecraft: [['Kenji Tanaka', 'James Wilson']], japan: [['Priya Sharma', 'Sofia Rossi'], ['Kenji Tanaka', 'Olivia Brown']], guitar: [['Tomáš Dvořák', 'Olivia Brown'], ['James Wilson', 'Sofia Rossi']] };
  for (const [key, pairs] of Object.entries(RARE)) {
    for (let i = links.length - 1; i >= 0; i -= 1) if (links[i][2] === key) links.splice(i, 1);
    for (const [a, b] of pairs) links.push([a, b, key]);
  }
  let made = 0;
  for (const [from, to, key] of links) {
    const result = await call('/api/play/connections', { method: 'POST', headers: { 'x-player-token': players[from] }, body: { otherId: personId[to], topicId: topicId[key] } });
    if (result.status === 200) made += 1;
    else if (result.status !== 409) throw new Error(`connection ${from} - ${to} (${key}) failed: ${result.status} ${JSON.stringify(result.json)}`);
  }

  const final = await expectOk(call(`/api/manage/games/${game.id}`, { headers: admin }), 'read game');
  const connected = new Set(final.connections.flatMap((c) => [c.aId ?? c.a, c.bId ?? c.b]));
  const alone = final.participants.filter((p) => !connected.has(p.id)).map((p) => p.name);
  if (alone.length > 0) throw new Error(`Nobody should be alone, but: ${alone.join(', ')}`);

  if (args.minutes) {
    await expectOk(call(`/api/manage/games/${game.id}`, { method: 'PATCH', headers: admin, body: { timerMinutes: Number(args.minutes), shortUrl: 'example.com/dots' } }), 'set timer');
    await expectOk(call(`/api/manage/games/${game.id}/timer`, { method: 'POST', headers: admin, body: { action: 'start' } }), 'start timer');
  }
  console.log(`${final.participants.length} people, ${final.topics.length} topics, ${made} connections, nobody alone.`);
  console.log(JSON.stringify({ id: game.id, code: game.code, players: Object.fromEntries(names.map((n) => [n, { id: personId[n], token: players[n] }])) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
