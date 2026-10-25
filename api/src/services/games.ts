import { randomInt, randomUUID } from 'node:crypto';
import {
  LIMITS,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_TOPICS,
  nameKey,
  type AdminConnection,
  type GameSettings,
  type TimerState,
  type GameDetails,
  type GameSummary,
  type Participant,
  type Topic,
  type Unchanged,
} from '@ctd/shared';
import { HttpError } from '../http';
import { ConflictError, type Entity, type Tables } from '../storage/tables';

export interface Deps {
  tables: Tables;
  now: () => Date;
  /** Returns a 6-digit code such as "042917". */
  randomCode: () => string;
  newId: () => string;
}

export function defaultDeps(tables: Tables): Deps {
  return {
    tables,
    now: () => new Date(),
    randomCode: () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
    newId: () => randomUUID().replace(/-/g, ''),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GAME_ID = /^[a-f0-9]{32}$/;
const CODE_ATTEMPTS = 30;

export function cleanName(value: unknown, maxLength: number, what: string): string {
  if (typeof value !== 'string') throw new HttpError(400, `${what} is required`);
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, `${what} is required`);
  if (name.length > maxLength) throw new HttpError(400, `${what} must be at most ${maxLength} characters`);
  return name;
}

function str(entity: Entity, key: string): string {
  const value = entity[key];
  return typeof value === 'string' ? value : '';
}

function toSummary(entity: Entity, now: Date): GameSummary {
  const expiresAt = str(entity, 'expiresAt');
  return {
    id: entity.rowKey === 'game' ? entity.partitionKey : entity.rowKey,
    name: str(entity, 'name'),
    code: str(entity, 'code'),
    createdAt: str(entity, 'createdAt'),
    expiresAt,
    expired: Date.parse(expiresAt) <= now.getTime(),
  };
}

/** Loads a game and checks that the admin owns it. Unknown and foreign games both look like 404. */
export async function getOwnedGameEntity(deps: Deps, ownerId: string, gameId: string): Promise<Entity> {
  if (!GAME_ID.test(gameId)) throw new HttpError(404, 'Game not found');
  const game = await deps.tables.get('Games', gameId, 'game');
  if (!game || game.ownerId !== ownerId) throw new HttpError(404, 'Game not found');
  return game;
}

/**
 * Marks that something in the game changed and optionally updates fields of the game row.
 * Clients poll with the version they have and only compare it for equality, so the version is
 * a value that is different for every write: the current time in microseconds plus a random
 * part. Two simultaneous writers therefore (practically) never produce the same version, and
 * for a single writer it always increases. It re-reads the row and merges only the touched
 * properties, so a stale copy held by the caller can never overwrite other changes (like an
 * admin's rename).
 */
export async function bumpVersion(
  deps: Deps,
  game: Entity,
  changes: Record<string, string | number | boolean> = {},
): Promise<Entity> {
  const fresh = (await deps.tables.get('Games', game.partitionKey, 'game')) ?? game;
  const previous = typeof fresh.version === 'number' ? fresh.version : 0;
  const candidate = deps.now().getTime() * 1000 + randomInt(1000);
  const version = candidate > previous ? candidate : previous + 1;
  const next: Entity = { ...fresh, ...changes, version };
  await deps.tables.merge('Games', { partitionKey: game.partitionKey, rowKey: 'game', ...changes, version });
  return next;
}

export async function listGames(deps: Deps, ownerId: string): Promise<GameSummary[]> {
  const rows = await deps.tables.list('OwnerGames', ownerId);
  const now = deps.now();
  return rows
    .map((row) => toSummary(row, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** GameCodes has exactly one row per code, so inserting a taken code fails atomically. */
const CODE_ROW = 'code';

async function reserveCode(deps: Deps, gameId: string, expiresAt: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = deps.randomCode();
    const row: Entity = { partitionKey: code, rowKey: CODE_ROW, gameId, expiresAt };
    try {
      await deps.tables.insert('GameCodes', row);
      return code;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
    }
    // The code is only free again when the game that used it has expired.
    const holder = await deps.tables.get('GameCodes', code, CODE_ROW);
    if (holder && Date.parse(str(holder, 'expiresAt')) <= deps.now().getTime()) {
      await deps.tables.delete('GameCodes', code, CODE_ROW);
      try {
        await deps.tables.insert('GameCodes', row);
        return code;
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error; // someone else took it first: try another code
      }
    }
  }
  throw new HttpError(503, 'Could not allocate a game code, please try again');
}

/**
 * Makes sure `gameId` holds `code` until `expiresAt` and returns the code it ends up with.
 * Normally that is the same code. If the code was reused by another (still active) game while this
 * one was expired, this game gets a new code instead, so it never steals another game's code.
 */
async function claimCode(deps: Deps, gameId: string, code: string, expiresAt: string): Promise<string> {
  const row: Entity = { partitionKey: code, rowKey: CODE_ROW, gameId, expiresAt };
  const holder = await deps.tables.get('GameCodes', code, CODE_ROW);

  if (!holder) {
    try {
      await deps.tables.insert('GameCodes', row);
      return code;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      return reserveCode(deps, gameId, expiresAt); // someone took it a moment ago
    }
  }
  if (holder.gameId === gameId) {
    await deps.tables.upsert('GameCodes', row);
    return code;
  }
  if (Date.parse(str(holder, 'expiresAt')) <= deps.now().getTime()) {
    // The other holder is expired too: take the code over.
    await deps.tables.upsert('GameCodes', row);
    return code;
  }
  return reserveCode(deps, gameId, expiresAt);
}

export async function createGame(deps: Deps, ownerId: string, rawName: unknown): Promise<GameSummary> {
  const name = cleanName(rawName, LIMITS.maxGameNameLength, 'Game name');
  const existing = await deps.tables.list('OwnerGames', ownerId);
  if (existing.length >= LIMITS.maxGamesPerAdmin) {
    throw new HttpError(409, `You can have at most ${LIMITS.maxGamesPerAdmin} games. Delete an old game first.`);
  }

  const now = deps.now();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + LIMITS.defaultExpiryDays * DAY_MS).toISOString();
  const id = deps.newId();
  const code = await reserveCode(deps, id, expiresAt);

  await deps.tables.insert('Games', {
    partitionKey: id,
    rowKey: 'game',
    ownerId,
    name,
    code,
    createdAt,
    expiresAt,
    shortUrl: '',
    rulesText: '',
    timerMinutes: DEFAULT_TIMER_MINUTES,
    timerState: 'idle',
    timerEndsAt: '',
    timerRemainingSec: 0,
    showNames: false,
    version: 1,
  });
  // Every new game starts with the default topics. The game shows up in the owner's list only once they are in place.
  await Promise.all(
    DEFAULT_TOPICS.map((topic) =>
      deps.tables.insert('Topics', { partitionKey: id, rowKey: nameKey(topic), name: topic, createdBy: ownerId, createdAt }),
    ),
  );
  await deps.tables.insert('OwnerGames', { partitionKey: ownerId, rowKey: id, name, code, createdAt, expiresAt });
  return toSummary({ partitionKey: id, rowKey: 'game', name, code, createdAt, expiresAt }, now);
}

function versionOf(game: Entity): number {
  return typeof game.version === 'number' ? game.version : 0;
}

/** The screen settings of a game (older games without them get the defaults). */
export function settingsOf(game: Entity): GameSettings {
  return {
    shortUrl: str(game, 'shortUrl'),
    rulesText: str(game, 'rulesText'),
    timerMinutes: typeof game.timerMinutes === 'number' ? game.timerMinutes : DEFAULT_TIMER_MINUTES,
    showNames: game.showNames === true,
  };
}

/** The countdown as of `now`: a running timer counts down from its end time. */
export function timerOf(game: Entity, now: Date): TimerState {
  const { timerMinutes } = settingsOf(game);
  const state = game.timerState === 'running' || game.timerState === 'paused' ? game.timerState : 'idle';
  if (state === 'running') {
    const endsAt = Date.parse(str(game, 'timerEndsAt'));
    const remainingSec = Number.isNaN(endsAt) ? 0 : Math.max(0, Math.ceil((endsAt - now.getTime()) / 1000));
    return { state, minutes: timerMinutes, remainingSec };
  }
  if (state === 'paused') {
    const remaining = typeof game.timerRemainingSec === 'number' ? game.timerRemainingSec : 0;
    return { state, minutes: timerMinutes, remainingSec: remaining };
  }
  return { state: 'idle', minutes: timerMinutes, remainingSec: timerMinutes * 60 };
}

/** All connections of a game with people and topic names filled in, newest first. */
export async function listAdminConnections(
  deps: Deps,
  gameId: string,
  participants: Participant[],
  topics: Topic[],
): Promise<AdminConnection[]> {
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  const topicOf = new Map(topics.map((t) => [t.id, t.name]));
  const rows = await deps.tables.list('Connections', gameId);
  return rows
    // Ignore connections whose topic or person was removed a moment ago (a race with the admin).
    .filter((row) => topicOf.has(str(row, 'topicId')) && nameOf.has(str(row, 'aId')) && nameOf.has(str(row, 'bId')))
    .map((row) => ({
      id: row.rowKey,
      aId: str(row, 'aId'),
      aName: nameOf.get(str(row, 'aId')) ?? '',
      bId: str(row, 'bId'),
      bName: nameOf.get(str(row, 'bId')) ?? '',
      topicId: str(row, 'topicId'),
      topicName: topicOf.get(str(row, 'topicId')) ?? '',
      createdBy: str(row, 'createdBy'),
      createdAt: str(row, 'createdAt'),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function buildDetails(deps: Deps, game: Entity): Promise<GameDetails> {
  const [participants, topics] = await Promise.all([
    listParticipants(deps, game.partitionKey),
    listTopics(deps, game.partitionKey),
  ]);
  const connections = await listAdminConnections(deps, game.partitionKey, participants, topics);
  const now = deps.now();
  return {
    ...toSummary(game, now),
    participants,
    topics,
    connections,
    settings: settingsOf(game),
    timer: timerOf(game, now),
    version: versionOf(game),
  };
}

export async function getGame(deps: Deps, ownerId: string, gameId: string): Promise<GameDetails> {
  return buildDetails(deps, await getOwnedGameEntity(deps, ownerId, gameId));
}

/**
 * Polling variant of getGame: when the client already has this version, answers with a tiny
 * "unchanged" reply instead of reading and sending the whole game again.
 */
export async function getGameIfChanged(
  deps: Deps,
  ownerId: string,
  gameId: string,
  since: number | undefined,
): Promise<GameDetails | Unchanged> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  if (since !== undefined && since === versionOf(game)) return { unchanged: true, version: since };
  return buildDetails(deps, game);
}

export async function listParticipants(deps: Deps, gameId: string): Promise<Participant[]> {
  const rows = await deps.tables.list('Participants', gameId);
  return rows
    .map((row) => ({ id: row.rowKey, name: str(row, 'name') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTopics(deps: Deps, gameId: string): Promise<Topic[]> {
  const rows = await deps.tables.list('Topics', gameId);
  return rows
    .map((row) => ({ id: row.rowKey, name: str(row, 'name') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface GameUpdate {
  name?: unknown;
  expiresAt?: unknown;
  shortUrl?: unknown;
  rulesText?: unknown;
  timerMinutes?: unknown;
  showNames?: unknown;
}

/** Accepts "", "aka.ms/connect" or "https://aka.ms/connect"; rejects anything that is not a web address. */
function cleanShortUrl(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'shortUrl must be text');
  const text = value.trim();
  if (text === '') return '';
  if (text.length > LIMITS.maxShortUrlLength) {
    throw new HttpError(400, `The short URL can have at most ${LIMITS.maxShortUrlLength} characters`);
  }
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) throw new Error();
  } catch {
    throw new HttpError(400, 'Enter a web address such as aka.ms/connect');
  }
  return text;
}

export async function updateGame(
  deps: Deps,
  ownerId: string,
  gameId: string,
  update: GameUpdate,
): Promise<GameSummary> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  const now = deps.now();
  const changes: { name?: string; expiresAt?: string; code?: string } = {};
  const settings: Record<string, string | number | boolean> = {};

  if (update.name !== undefined) changes.name = cleanName(update.name, LIMITS.maxGameNameLength, 'Game name');
  if (update.shortUrl !== undefined) settings.shortUrl = cleanShortUrl(update.shortUrl);
  if (update.rulesText !== undefined) {
    if (typeof update.rulesText !== 'string') throw new HttpError(400, 'rulesText must be text');
    if (update.rulesText.length > LIMITS.maxRulesLength) {
      throw new HttpError(400, `The rules can have at most ${LIMITS.maxRulesLength} characters`);
    }
    settings.rulesText = update.rulesText.trim();
  }
  if (update.showNames !== undefined) {
    if (typeof update.showNames !== 'boolean') throw new HttpError(400, 'showNames must be true or false');
    settings.showNames = update.showNames;
  }
  if (update.timerMinutes !== undefined) {
    const minutes = update.timerMinutes;
    if (
      typeof minutes !== 'number' ||
      !Number.isInteger(minutes) ||
      minutes < LIMITS.minTimerMinutes ||
      minutes > LIMITS.maxTimerMinutes
    ) {
      throw new HttpError(400, `The timer must be ${LIMITS.minTimerMinutes}-${LIMITS.maxTimerMinutes} whole minutes`);
    }
    if (timerOf(game, now).state !== 'idle') throw new HttpError(409, 'Reset the timer before changing its length');
    settings.timerMinutes = minutes;
  }

  if (update.expiresAt !== undefined) {
    const time = typeof update.expiresAt === 'string' ? Date.parse(update.expiresAt) : Number.NaN;
    if (Number.isNaN(time)) throw new HttpError(400, 'expiresAt must be a date');
    if (time <= now.getTime()) throw new HttpError(400, 'The expiry date must be in the future');
    if (time > now.getTime() + LIMITS.maxExpiryDays * DAY_MS) {
      throw new HttpError(400, `The expiry date can be at most ${LIMITS.maxExpiryDays} days from now`);
    }
    changes.expiresAt = new Date(time).toISOString();
    const code = await claimCode(deps, gameId, str(game, 'code'), changes.expiresAt);
    if (code !== str(game, 'code')) changes.code = code;
  }

  const updated = await bumpVersion(deps, game, { ...changes, ...settings });
  const ownerRow = await deps.tables.get('OwnerGames', ownerId, gameId);
  if (ownerRow) await deps.tables.upsert('OwnerGames', { ...ownerRow, ...changes });
  return toSummary(updated, now);
}

/** Permanently removes a game row with everything that belongs to it. Used by delete and by the cleanup job. */
export async function purgeGame(deps: Deps, game: Entity): Promise<void> {
  const gameId = game.partitionKey;
  await deps.tables.deletePartition('Connections', gameId);
  await deps.tables.deletePartition('Topics', gameId);
  await deps.tables.deletePartition('Participants', gameId);
  // Only release the code if this game still holds it (an expired game's code may have been reused).
  const code = str(game, 'code');
  const holder = await deps.tables.get('GameCodes', code, CODE_ROW);
  if (holder && holder.gameId === gameId) await deps.tables.delete('GameCodes', code, CODE_ROW);
  await deps.tables.delete('OwnerGames', str(game, 'ownerId'), gameId);
  await deps.tables.delete('Games', gameId, 'game');
}

/** Permanently deletes a game and everything in it (the admin's "Delete game"). */
export async function deleteGame(deps: Deps, ownerId: string, gameId: string): Promise<void> {
  await purgeGame(deps, await getOwnedGameEntity(deps, ownerId, gameId));
}
