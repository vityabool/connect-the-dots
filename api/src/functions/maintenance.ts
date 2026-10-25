import { createHash, timingSafeEqual } from 'node:crypto';
import { app, type HttpRequest } from '@azure/functions';
import { HttpError, json } from '../http';
import { runCleanup } from '../services/cleanup';
import { defaultDeps, type Deps } from '../services/games';
import { getTables } from '../storage';

/** Compares two secrets without leaking their length or content through timing. */
export function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Daily data-retention job (called by the scheduled GitHub Actions workflow `cleanup.yml`).
 * Not available (404) unless the CLEANUP_TOKEN setting exists; otherwise it needs that token in a header.
 */
export function cleanupHandler(
  makeDeps: () => Deps,
  token: () => string | undefined = () => process.env.CLEANUP_TOKEN,
) {
  return json(async (request: HttpRequest) => {
    const expected = token();
    if (!expected) throw new HttpError(404, 'Not found');
    if (!sameSecret(request.headers.get('x-cleanup-token') ?? '', expected)) throw new HttpError(401, 'Unauthorized');
    return runCleanup(makeDeps());
  });
}

app.http('maintenanceCleanup', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'maintenance/cleanup',
  handler: cleanupHandler(() => defaultDeps(getTables())),
});
