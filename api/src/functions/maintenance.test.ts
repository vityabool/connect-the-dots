import { HttpRequest, InvocationContext } from '@azure/functions';
import { describe, expect, it } from 'vitest';
import { createGame } from '../services/games';
import { makeDeps } from '../services/testing';
import { cleanupHandler, sameSecret } from './maintenance';

const request = (token?: string) =>
  new HttpRequest({ url: 'http://localhost/api/maintenance/cleanup', method: 'POST', headers: token === undefined ? {} : { 'x-cleanup-token': token } });
const context = new InvocationContext();

describe('sameSecret', () => {
  it('matches only identical values', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('', 'abc')).toBe(false);
    expect(sameSecret('abc', 'abcd')).toBe(false);
  });
});

describe('cleanup endpoint', () => {
  it('does not exist when no token is configured', async () => {
    const { deps } = makeDeps();
    const response = await cleanupHandler(() => deps, () => undefined)(request('anything'), context);
    expect(response.status).toBe(404);
  });

  it('rejects a missing or wrong token', async () => {
    const { deps } = makeDeps();
    const handler = cleanupHandler(() => deps, () => 'secret-token');
    expect((await handler(request(), context)).status).toBe(401);
    expect((await handler(request('wrong'), context)).status).toBe(401);
  });

  it('runs the cleanup with the right token and reports what it did', async () => {
    const ctx = makeDeps();
    await createGame(ctx.deps, 'owner', 'Old game');
    ctx.advanceDays(40);
    const handler = cleanupHandler(() => ctx.deps, () => 'secret-token');
    const response = await handler(request('secret-token'), context);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ gamesDeleted: 1, rateLimitRowsDeleted: 0, orphanRowsDeleted: 0 });
  });
});
