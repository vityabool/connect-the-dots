/** Limits shared by the API (enforcement) and the web app (friendly hints). */
export const LIMITS = {
  maxGamesPerAdmin: 50,
  maxParticipants: 200,
  maxNameLength: 100,
  maxGameNameLength: 80,
  maxTopics: 200,
  /** Short on purpose: long topic names do not fit in lists, buttons and the graph legend. */
  maxTopicNameLength: 30,
  maxShortUrlLength: 200,
  maxRulesLength: 1000,
  minTimerMinutes: 1,
  maxTimerMinutes: 240,
  defaultExpiryDays: 3,
  /** An admin can push the expiry date at most this many days into the future. */
  maxExpiryDays: 30,
} as const;

export interface GameSummary {
  id: string;
  name: string;
  /** 6-digit code players use to join. */
  code: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface Participant {
  id: string;
  name: string;
}

export interface GameDetails extends GameSummary {
  participants: Participant[];
  topics: Topic[];
  connections: AdminConnection[];
  settings: GameSettings;
  timer: TimerState;
  /** Incremented on every change to the game (used for cheap polling). */
  version: number;
}

/** Facilitator settings that shape the big-screen views. */
export interface GameSettings {
  /** Short link (for example an is.gd or aka.ms address) shown on the Timer screen; empty when not set. */
  shortUrl: string;
  /** Rules shown on the Timer screen; empty means "use DEFAULT_RULES". */
  rulesText: string;
  /** Length of the countdown in minutes. */
  timerMinutes: number;
  /** Show participant names on the Timer screen graph. */
  showNames: boolean;
}

export type TimerStatus = 'idle' | 'running' | 'paused';

/** The countdown as of the moment the server answered. */
export interface TimerState {
  state: TimerStatus;
  minutes: number;
  /** Seconds left at the time of the response (0 after the time is up). */
  remainingSec: number;
}

export type TimerAction = 'start' | 'pause' | 'reset';

export const DEFAULT_TIMER_MINUTES = 30;

/** Shown on the Timer screen when the facilitator did not write their own rules. */
export const DEFAULT_RULES: readonly string[] = [
  'Walk around the room and talk to your colleagues in person.',
  'Look for things you have in common: hobbies, places, experiences, past jobs.',
  'Every time you find a match, add it in the app: pick the person and the topic.',
  'Round 1: find your people. Round 2: find unexpected links. Round 3: connect everyone into one network.',
];

export interface AddParticipantsResult {
  added: Participant[];
  /** Names skipped because they already exist (inside the file or in the game). */
  duplicatesSkipped: number;
  /** Names skipped because they are longer than the allowed length. */
  tooLongSkipped: number;
}

export interface Topic {
  id: string;
  name: string;
}

/**
 * The topics every new game starts with. The facilitator can rename, delete or add topics at any time
 * (the "Restore the default topics" button adds back any that were deleted).
 */
export const DEFAULT_TOPICS: readonly string[] = [
  '🎾 Play tennis',
  '🐕 Have dogs',
  '✈️ Visited Japan',
  '🎸 Play guitar',
  '🏃 Run a half-marathon',
  '🎮 Play Minecraft',
  '⛷️ Enjoy skiing',
  '🗣️ Speak French',
  '🍕 Love pineapple on pizza',
  '🚗 Drive electric cars',
];

export interface AddTopicsResult {
  added: Topic[];
  duplicatesSkipped: number;
  /** Topics that were longer than the limit and were cut to it, ending with "…". */
  shortened: number;
}

/** Returned when a player joins with a game code. */
export interface JoinResult {
  /** Signed token the player sends with every later request. */
  token: string;
  game: { id: string; name: string };
  participants: Participant[];
}

/** A connection as seen by one of the two people in it. */
export interface MyConnection {
  id: string;
  otherId: string;
  otherName: string;
  topicId: string;
  topicName: string;
  /** True when this player created it (otherwise the other person added them). */
  createdByMe: boolean;
  createdAt: string;
}

/** Everything a player's screen needs. Players only ever receive their own connections. */
export interface PlayState {
  game: { id: string; name: string; expiresAt: string; version: number };
  me: Participant;
  participants: Participant[];
  topics: Topic[];
  connections: MyConnection[];
}

export interface CreateConnectionInput {
  otherId: string;
  /** Existing topic id, or ... */
  topicId?: string;
  /** ... the name of a new (or already existing, matched case-insensitively) topic. */
  newTopicName?: string;
}

/** Reply to a poll when nothing changed since the version the client already has. */
export interface Unchanged {
  unchanged: true;
  version: number;
}

export function isUnchanged(value: unknown): value is Unchanged {
  return typeof value === 'object' && value !== null && (value as Unchanged).unchanged === true;
}

/** A connection as the facilitator sees it (all connections of the game, with names). */
export interface AdminConnection {
  id: string;
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  topicId: string;
  topicName: string;
  createdBy: string;
  createdAt: string;
}

export interface DeleteTopicResult {
  deletedConnections: number;
}

export interface MergeTopicsResult {
  /** Connections moved to the target topic. */
  moved: number;
  /** Connections dropped because the pair was already connected on the target topic. */
  duplicatesDropped: number;
}
