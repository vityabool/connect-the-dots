#!/usr/bin/env node
/**
 * End-to-end check of the HTTP API: drives every endpoint through the real Azure Functions host
 * (routing, headers, JSON, status codes), as an admin and as players.
 *
 * Needs a LOCAL API with Azurite (it sends the sign-in header that only the platform sets in production):
 *   npm run dev:storage        # terminal 1
 *   npm run dev:api            # terminal 2
 *   node scripts/e2e-api.mjs [--base http://localhost:7072]
 *
 * Exits with a non-zero code when any check fails.
 */
const baseFlag = process.argv.indexOf('--base');
const base = String(baseFlag >= 0 ? process.argv[baseFlag + 1] : 'http://localhost:7072').replace(/\/$/, '');
const header = (userId) => ({
  'x-ms-client-principal': Buffer.from(
    JSON.stringify({ userId, userDetails: `${userId}@example.com`, identityProvider: 'aad', userRoles: ['anonymous', 'authenticated'] }),
  ).toString('base64'),
});
const adminA = header(`e2e-admin-a-${Date.now()}`);
const adminB = header(`e2e-admin-b-${Date.now()}`);

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) passed += 1;
  else {
    failures.push(`${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

const M = '/api/manage';

async function main() {
  console.log(`API end-to-end against ${base}`);

  // --- health and access control
  check('health', (await call('/api/health')).json?.status === 'ok');
  check('admin endpoints need a sign-in', (await call(`${M}/games`)).status === 401);
  check('admin me works with the header', (await call(`${M}/me`, { headers: adminA })).json?.displayName?.includes('e2e-admin-a'));

  // --- create and configure a game
  const created = await call(`${M}/games`, { method: 'POST', headers: adminA, body: { name: 'E2E game' } });
  check('create game', created.status === 200 && /^\d{6}$/.test(created.json?.code), created);
  const game = created.json;
  const G = `${M}/games/${game.id}`;
  check('empty name rejected', (await call(`${M}/games`, { method: 'POST', headers: adminA, body: { name: ' ' } })).status === 400);
  check('list shows the game', (await call(`${M}/games`, { headers: adminA })).json?.some((g) => g.id === game.id));
  check('other admin cannot see it', (await call(`${M}/games`, { headers: adminB })).json?.every((g) => g.id !== game.id));
  check('other admin gets 404', (await call(G, { headers: adminB })).status === 404);
  check('other admin cannot delete it', (await call(G, { method: 'DELETE', headers: adminB })).status === 404);

  const added = await call(`${G}/participants`, { method: 'POST', headers: adminA, body: { text: 'Anna Koval\nIvan Petrenko\nOlena Shevchenko\nanna koval\nГліб Фіногенов' } });
  check('participants added, duplicate skipped', added.json?.added?.length === 4 && added.json?.duplicatesSkipped === 1, added.json);
  const people = Object.fromEntries(added.json.added.map((p) => [p.name, p.id]));
  check('cyrillic name kept', 'Гліб Фіногенов' in people);

  const fresh = await call(G, { headers: adminA });
  check('a new game starts with the 10 default topics', fresh.json?.topics?.length === 10 && fresh.json.topics.some((t) => t.name === '🎾 Play tennis'), fresh.json?.topics);

  const topics = await call(`${G}/topics`, { method: 'POST', headers: adminA, body: { text: 'Have dogs\nPlay tennis\nChess' } });
  check('topics added', topics.json?.added?.length === 3, topics.json);
  const topic = Object.fromEntries(topics.json.added.map((t) => [t.name, t.id]));

  const patched = await call(G, { method: 'PATCH', headers: adminA, body: { name: 'E2E game (renamed)', shortUrl: 'aka.ms/e2e', rulesText: 'Be kind.', timerMinutes: 20, showNames: true } });
  check('settings saved', patched.status === 200, patched.json);
  check('bad short url rejected', (await call(G, { method: 'PATCH', headers: adminA, body: { shortUrl: 'javascript:alert(1)' } })).status === 400);

  // --- timer
  check('timer start', (await call(`${G}/timer`, { method: 'POST', headers: adminA, body: { action: 'start' } })).json?.state === 'running');
  check('timer pause', (await call(`${G}/timer`, { method: 'POST', headers: adminA, body: { action: 'pause' } })).json?.state === 'paused');
  check('timer reset', (await call(`${G}/timer`, { method: 'POST', headers: adminA, body: { action: 'reset' } })).json?.remainingSec === 1200);
  check('timer bad action', (await call(`${G}/timer`, { method: 'POST', headers: adminA, body: { action: 'x' } })).status === 400);

  // --- players
  check('wrong code', (await call('/api/play/join', { method: 'POST', body: { code: '000000' }, headers: { 'x-forwarded-for': '203.0.113.7' } })).status === 404);
  const join = async (name, ip) => {
    const joined = await call('/api/play/join', { method: 'POST', body: { code: game.code }, headers: { 'x-forwarded-for': ip } });
    check(`join as ${name}`, joined.status === 200 && joined.json?.participants?.length === 4, joined);
    const picked = await call('/api/play/identity', { method: 'POST', headers: { 'x-player-token': joined.json.token }, body: { participantId: people[name] } });
    check(`pick name ${name}`, picked.status === 200 && picked.json?.me?.name === name, picked);
    return { name, id: people[name], token: picked.json.token };
  };
  const anna = await join('Anna Koval', '198.51.100.1');
  const ivan = await join('Ivan Petrenko', '198.51.100.2');
  const olena = await join('Olena Shevchenko', '198.51.100.3');
  const asPlayer = (p) => ({ 'x-player-token': p.token });

  check('state needs an identity', (await call('/api/play/state', { headers: { 'x-player-token': 'junk' } })).status === 401);

  const first = await call('/api/play/state', { headers: asPlayer(anna) });
  check('state for Anna', first.status === 200 && first.json?.connections?.length === 0 && first.json?.topics?.length === 13, first.json);
  const version = first.json.game.version;
  check('state unchanged when nothing happened', (await call(`/api/play/state?since=${version}`, { headers: asPlayer(anna) })).json?.unchanged === true);

  const c1 = await call('/api/play/connections', { method: 'POST', headers: asPlayer(anna), body: { otherId: ivan.id, topicId: topic['Have dogs'] } });
  check('Anna connects with Ivan', c1.status === 200 && c1.json?.otherName === 'Ivan Petrenko', c1);
  check('connection id has colons', String(c1.json?.id).includes(':'));
  check('duplicate pair+topic rejected (either direction)', (await call('/api/play/connections', { method: 'POST', headers: asPlayer(ivan), body: { otherId: anna.id, topicId: topic['Have dogs'] } })).status === 409);
  check('same pair on another topic allowed', (await call('/api/play/connections', { method: 'POST', headers: asPlayer(anna), body: { otherId: ivan.id, topicId: topic['Chess'] } })).status === 200);
  const c3 = await call('/api/play/connections', { method: 'POST', headers: asPlayer(ivan), body: { otherId: olena.id, newTopicName: '  rock   climbing ' } });
  check('new topic created on the fly', c3.status === 200 && c3.json?.topicName === 'rock climbing', c3);
  check('cannot connect with yourself', (await call('/api/play/connections', { method: 'POST', headers: asPlayer(anna), body: { otherId: anna.id, topicId: topic['Chess'] } })).status === 400);

  check('change is noticed by polling', (await call(`/api/play/state?since=${version}`, { headers: asPlayer(ivan) })).json?.connections?.length === 3);
  const olenaState = await call('/api/play/state', { headers: asPlayer(olena) });
  check('players only see their own connections', olenaState.json?.connections?.length === 1 && olenaState.json.connections[0].otherName === 'Ivan Petrenko', olenaState.json?.connections);
  check('new topic visible to everyone', olenaState.json?.topics?.some((t) => t.name === 'rock climbing'));

  // --- admin view, deleting by a player and by the admin (ids contain colons)
  const details = await call(G, { headers: adminA });
  check('admin sees all connections', details.json?.connections?.length === 3, details.json?.connections);
  check('admin sees settings and timer', details.json?.settings?.shortUrl === 'aka.ms/e2e' && details.json?.timer?.minutes === 20, details.json);
  check('admin poll unchanged', (await call(`${G}?since=${details.json.version}`, { headers: adminA })).json?.unchanged === true);

  check('a third person cannot delete a connection', (await call(`/api/play/connections/${encodeURIComponent(c1.json.id)}`, { method: 'DELETE', headers: asPlayer(olena) })).status === 404);
  check('the person it was added with can delete it', (await call(`/api/play/connections/${encodeURIComponent(c1.json.id)}`, { method: 'DELETE', headers: asPlayer(ivan) })).status === 204);
  const adminConnections = (await call(G, { headers: adminA })).json.connections;
  const toDelete = adminConnections.find((c) => c.topicName === 'Chess');
  check('admin deletes a connection', (await call(`${G}/connections/${encodeURIComponent(toDelete.id)}`, { method: 'DELETE', headers: adminA })).status === 204);

  // --- topics: merge and delete
  await call('/api/play/connections', { method: 'POST', headers: asPlayer(anna), body: { otherId: olena.id, topicId: topic['Play tennis'] } });
  const merged = await call(`${G}/topics/${encodeURIComponent(topic['Play tennis'])}/merge`, { method: 'POST', headers: adminA, body: { targetId: topic['Have dogs'] } });
  check('topics merged', merged.status === 200 && merged.json?.moved === 1, merged);
  const deleted = await call(`${G}/topics/${encodeURIComponent(topic['Have dogs'])}`, { method: 'DELETE', headers: adminA });
  check('topic deleted with its connections', deleted.status === 200 && deleted.json?.deletedConnections === 1, deleted);

  // --- participants and expiry
  const gleb = people['Гліб Фіногенов'];
  check('participant deleted', (await call(`${G}/participants/${encodeURIComponent(gleb)}`, { method: 'DELETE', headers: adminA })).status === 204);
  const extended = await call(G, { method: 'PATCH', headers: adminA, body: { expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString() } });
  check('expiry extended', extended.status === 200, extended);
  check('expiry in the past rejected', (await call(G, { method: 'PATCH', headers: adminA, body: { expiresAt: new Date(Date.now() - 1000).toISOString() } })).status === 400);

  // --- brute-force protection
  let blocked = false;
  for (let i = 0; i < 12; i += 1) {
    const r = await call('/api/play/join', { method: 'POST', body: { code: '000001' }, headers: { 'x-forwarded-for': '192.0.2.99:5555' } });
    if (r.status === 429) blocked = true;
  }
  check('too many wrong codes are blocked', blocked);

  // --- data retention job
  const cleanupToken = process.env.CLEANUP_TOKEN ?? 'local-cleanup-token';
  check('cleanup needs the token', (await call('/api/maintenance/cleanup', { method: 'POST' })).status === 401);
  check('cleanup rejects a wrong token', (await call('/api/maintenance/cleanup', { method: 'POST', headers: { 'x-cleanup-token': 'nope' } })).status === 401);
  const cleaned = await call('/api/maintenance/cleanup', { method: 'POST', headers: { 'x-cleanup-token': cleanupToken } });
  check('cleanup runs with the token and keeps the active game', cleaned.status === 200 && typeof cleaned.json?.gamesDeleted === 'number', cleaned);
  check('the active game survived the cleanup', (await call(G, { headers: adminA })).status === 200);
  const rateRows = cleaned.json?.rateLimitRowsDeleted;
  check('cleanup reports rate-limit rows', typeof rateRows === 'number');

  // --- delete the game
  check('delete game', (await call(G, { method: 'DELETE', headers: adminA })).status === 204);
  check('game is gone for the admin', (await call(G, { headers: adminA })).status === 404);
  check('code no longer works', (await call('/api/play/join', { method: 'POST', body: { code: game.code }, headers: { 'x-forwarded-for': '198.51.100.50' } })).status === 404);
  check('players are told to join again', (await call('/api/play/state', { headers: asPlayer(anna) })).status === 404);

  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log(failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
