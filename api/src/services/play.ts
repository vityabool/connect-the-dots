import {
  connectionKey,
  type CreateConnectionInput,
  type JoinResult,
  type MyConnection,
  type PlayState,
  type Unchanged,
} from '@ctd/shared';
import { HttpError } from '../http';
import { signPlayerToken, verifyPlayerToken, type PlayerClaims } from '../playerToken';
import { ConflictError, type Entity } from '../storage/tables';
import { bumpVersion, listParticipants, listTopics, type Deps } from './games';
import { assertNotBlocked, hashClient, recordFailure } from './rateLimit';
import { getOrCreateTopic } from './topics';

const MAX_WRONG_CODES = 10;

function str(entity: Entity, key: string): string {
  const value = entity[key];
  return typeof value === 'string' ? value : '';
}

/** The verified identity of the caller plus the (active) game they belong to. */
export interface PlayContext {
  claims: PlayerClaims;
  gameId: string;
  game: Entity;
}

/** A game that exists and has not expired; throws 404 / 410 otherwise. */
async function loadActiveGame(deps: Deps, gameId: string): Promise<Entity> {
  const game = await deps.tables.get('Games', gameId, 'game');
  if (!game) throw new HttpError(404, 'Game not found');
  if (Date.parse(str(game, 'expiresAt')) <= deps.now().getTime()) {
    throw new HttpError(410, 'This game has ended');
  }
  return game;
}

/** Player joins with the 6-digit code. Wrong codes are rate-limited per client address. */
export async function joinGame(deps: Deps, secret: string, rawCode: unknown, clientKey: string): Promise<JoinResult> {
  const limiterKey = `join:${hashClient(secret, clientKey)}`;
  await assertNotBlocked(deps, limiterKey, MAX_WRONG_CODES);

  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  const holder = /^\d{6}$/.test(code) ? await deps.tables.get('GameCodes', code, 'code') : undefined;
  const game = holder ? await deps.tables.get('Games', str(holder, 'gameId'), 'game') : undefined;
  if (!game) {
    await recordFailure(deps, limiterKey);
    throw new HttpError(404, 'We could not find a game with that code');
  }
  if (Date.parse(str(game, 'expiresAt')) <= deps.now().getTime()) throw new HttpError(410, 'This game has ended');

  const gameId = game.partitionKey;
  return {
    token: signPlayerToken({ gameId }, secret, deps.now()),
    game: { id: gameId, name: str(game, 'name') },
    participants: await listParticipants(deps, gameId),
  };
}

/** Checks the token and the game. Does not require a chosen identity yet. */
export async function authenticate(deps: Deps, secret: string, token: string | null): Promise<PlayContext> {
  const claims = verifyPlayerToken(token, secret, deps.now());
  if (!claims) throw new HttpError(401, 'Please join the game again');
  const game = await loadActiveGame(deps, claims.gameId);
  return { claims, gameId: claims.gameId, game };
}

/** Like authenticate, and additionally requires that the player picked a name that still exists. */
export async function authenticateIdentified(
  deps: Deps,
  secret: string,
  token: string | null,
): Promise<PlayContext & { me: { id: string; name: string } }> {
  const ctx = await authenticate(deps, secret, token);
  const meId = ctx.claims.participantId;
  const me = meId ? await deps.tables.get('Participants', ctx.gameId, meId) : undefined;
  if (!meId || !me) throw new HttpError(401, 'Please choose your name again');
  return { ...ctx, me: { id: meId, name: str(me, 'name') } };
}

/** Player picks who they are. Returns a new token that carries the identity. */
export async function pickIdentity(
  deps: Deps,
  secret: string,
  ctx: PlayContext,
  participantId: unknown,
): Promise<{ token: string; me: { id: string; name: string } }> {
  if (typeof participantId !== 'string') throw new HttpError(400, 'participantId is required');
  const participant = await deps.tables.get('Participants', ctx.gameId, participantId);
  if (!participant) throw new HttpError(404, 'That name is not in this game');
  return {
    token: signPlayerToken({ gameId: ctx.gameId, participantId }, secret, deps.now()),
    me: { id: participantId, name: str(participant, 'name') },
  };
}

export async function getPlayState(
  deps: Deps,
  ctx: PlayContext & { me: { id: string; name: string } },
): Promise<PlayState> {
  const [participants, topics, rows] = await Promise.all([
    listParticipants(deps, ctx.gameId),
    listTopics(deps, ctx.gameId),
    deps.tables.list('Connections', ctx.gameId),
  ]);
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  const topicOf = new Map(topics.map((t) => [t.id, t.name]));

  // Connections whose topic or person was removed a moment ago (a race with the admin) are ignored.
  const connections: MyConnection[] = rows
    .filter((row) => row.aId === ctx.me.id || row.bId === ctx.me.id)
    .filter((row) => topicOf.has(str(row, 'topicId')) && nameOf.has(str(row, 'aId')) && nameOf.has(str(row, 'bId')))
    .map((row) => toMyConnection(row, ctx.me.id, nameOf, topicOf))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    game: {
      id: ctx.gameId,
      name: str(ctx.game, 'name'),
      expiresAt: str(ctx.game, 'expiresAt'),
      version: typeof ctx.game.version === 'number' ? ctx.game.version : 0,
    },
    me: ctx.me,
    participants,
    topics,
    connections,
  };
}

/**
 * Polling variant of getPlayState: when the player already has the current game version, answers
 * with a tiny "unchanged" reply instead of reading all participants, topics and connections.
 */
export async function getPlayStateIfChanged(
  deps: Deps,
  ctx: PlayContext & { me: { id: string; name: string } },
  since: number | undefined,
): Promise<PlayState | Unchanged> {
  const version = typeof ctx.game.version === 'number' ? ctx.game.version : 0;
  if (since !== undefined && since === version) return { unchanged: true, version };
  return getPlayState(deps, ctx);
}

function toMyConnection(
  row: Entity,
  meId: string,
  nameOf: Map<string, string>,
  topicOf: Map<string, string>,
): MyConnection {
  const otherId = row.aId === meId ? str(row, 'bId') : str(row, 'aId');
  const topicId = str(row, 'topicId');
  return {
    id: row.rowKey,
    otherId,
    otherName: nameOf.get(otherId) ?? '',
    topicId,
    topicName: topicOf.get(topicId) ?? '',
    createdByMe: row.createdBy === meId,
    createdAt: str(row, 'createdAt'),
  };
}

export async function createConnection(
  deps: Deps,
  ctx: PlayContext & { me: { id: string; name: string } },
  input: Partial<CreateConnectionInput>,
): Promise<MyConnection> {
  const { otherId } = input;
  if (typeof otherId !== 'string') throw new HttpError(400, 'Choose who you want to connect with');
  if (otherId === ctx.me.id) throw new HttpError(400, 'You cannot connect with yourself');
  const other = await deps.tables.get('Participants', ctx.gameId, otherId);
  if (!other) throw new HttpError(404, 'That person is not in this game');

  let topicId: string;
  let topicName: string;
  if (typeof input.topicId === 'string' && input.topicId) {
    const topic = await deps.tables.get('Topics', ctx.gameId, input.topicId);
    if (!topic) throw new HttpError(404, 'That topic does not exist (it may have been removed)');
    topicId = input.topicId;
    topicName = str(topic, 'name');
  } else {
    const topic = await getOrCreateTopic(deps, ctx.gameId, input.newTopicName, ctx.me.id);
    topicId = topic.id;
    topicName = topic.name;
  }

  const createdAt = deps.now().toISOString();
  const rowKey = connectionKey(ctx.me.id, otherId, topicId);
  try {
    await deps.tables.insert('Connections', {
      partitionKey: ctx.gameId,
      rowKey,
      aId: ctx.me.id,
      bId: otherId,
      topicId,
      createdBy: ctx.me.id,
      createdAt,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      throw new HttpError(409, `You and ${str(other, 'name')} are already connected on "${topicName}"`);
    }
    throw error;
  }
  await bumpVersion(deps, ctx.game);
  return {
    id: rowKey,
    otherId,
    otherName: str(other, 'name'),
    topicId,
    topicName,
    createdByMe: true,
    createdAt,
  };
}

/** Either person of a connection may delete it; everyone else gets "not found". */
export async function deleteConnection(
  deps: Deps,
  ctx: PlayContext & { me: { id: string; name: string } },
  connectionId: string,
): Promise<void> {
  const row = await deps.tables.get('Connections', ctx.gameId, connectionId);
  if (!row || (row.aId !== ctx.me.id && row.bId !== ctx.me.id)) throw new HttpError(404, 'Connection not found');
  await deps.tables.delete('Connections', ctx.gameId, connectionId);
  await bumpVersion(deps, ctx.game);
}
