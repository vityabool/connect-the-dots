import { createHmac } from 'node:crypto';
import { HttpError } from '../http';
import type { Deps } from './games';

export const WINDOW_MS = 10 * 60 * 1000;

/**
 * A keyed hash of a client address. The rate limiter stores this instead of the address itself, so the
 * database never contains IP addresses (it only needs to recognise the same client again within 10 minutes).
 */
export function hashClient(secret: string, clientAddress: string): string {
  return createHmac('sha256', secret).update(clientAddress).digest('hex').slice(0, 32);
}

function bucketOf(deps: Deps): string {
  return String(Math.floor(deps.now().getTime() / WINDOW_MS));
}

/** Throws 429 when `key` already used up its failures in the current 10-minute window. */
export async function assertNotBlocked(deps: Deps, key: string, maxFailures: number): Promise<void> {
  const row = await deps.tables.get('RateLimits', key, bucketOf(deps));
  const failures = typeof row?.failures === 'number' ? row.failures : 0;
  if (failures >= maxFailures) {
    throw new HttpError(429, 'Too many wrong codes. Please wait a few minutes and try again.');
  }
}

/** Counts one failure for `key` in the current window (not atomic; good enough to slow guessing). */
export async function recordFailure(deps: Deps, key: string): Promise<void> {
  const bucket = bucketOf(deps);
  const row = await deps.tables.get('RateLimits', key, bucket);
  const failures = typeof row?.failures === 'number' ? row.failures : 0;
  await deps.tables.upsert('RateLimits', { partitionKey: key, rowKey: bucket, failures: failures + 1 });
  // Older windows of this client are no longer needed: do not keep them.
  for (const old of await deps.tables.list('RateLimits', key)) {
    if (old.rowKey !== bucket) await deps.tables.delete('RateLimits', key, old.rowKey);
  }
}
