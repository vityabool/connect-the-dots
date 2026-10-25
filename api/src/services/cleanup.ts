import { purgeGame, type Deps } from './games';
import { WINDOW_MS } from './rateLimit';

/** Expired games are kept this long (so a facilitator can still look at the results), then deleted. */
export const RETENTION_AFTER_EXPIRY_DAYS = 30;

/** Rate-limit counters only matter for minutes; anything older than this is deleted. */
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanupResult {
  gamesDeleted: number;
  rateLimitRowsDeleted: number;
  orphanRowsDeleted: number;
}

/**
 * Data minimisation job, run once a day:
 * - deletes games (with all participants, topics and connections) 30 days after they expired,
 * - deletes rate-limit counters older than a day,
 * - deletes index rows (game codes, owner lists) that point to games that no longer exist.
 * Safe to run any number of times.
 */
export async function runCleanup(deps: Deps): Promise<CleanupResult> {
  const now = deps.now().getTime();
  const result: CleanupResult = { gamesDeleted: 0, rateLimitRowsDeleted: 0, orphanRowsDeleted: 0 };

  for (const game of await deps.tables.scan('Games')) {
    const expiresAt = Date.parse(String(game.expiresAt ?? ''));
    if (Number.isNaN(expiresAt)) continue;
    if (expiresAt + RETENTION_AFTER_EXPIRY_DAYS * DAY_MS <= now) {
      await purgeGame(deps, game);
      result.gamesDeleted += 1;
    }
  }

  for (const row of await deps.tables.scan('RateLimits')) {
    const windowStart = Number(row.rowKey) * WINDOW_MS;
    if (Number.isNaN(windowStart) || windowStart + RATE_LIMIT_RETENTION_MS <= now) {
      await deps.tables.delete('RateLimits', row.partitionKey, row.rowKey);
      result.rateLimitRowsDeleted += 1;
    }
  }

  for (const row of await deps.tables.scan('GameCodes')) {
    if (!(await deps.tables.get('Games', String(row.gameId ?? ''), 'game'))) {
      await deps.tables.delete('GameCodes', row.partitionKey, row.rowKey);
      result.orphanRowsDeleted += 1;
    }
  }
  for (const row of await deps.tables.scan('OwnerGames')) {
    if (!(await deps.tables.get('Games', row.rowKey, 'game'))) {
      await deps.tables.delete('OwnerGames', row.partitionKey, row.rowKey);
      result.orphanRowsDeleted += 1;
    }
  }
  return result;
}
