import { HttpRequest } from '@azure/functions';
import { describe, expect, it } from 'vitest';
import { adminMeHandler } from './adminMe';

function request(principal?: object): HttpRequest {
  const headers: Record<string, string> = {};
  if (principal) headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(principal)).toString('base64');
  return new HttpRequest({ url: 'http://localhost/api/manage/me', method: 'GET', headers });
}

describe('GET /api/manage/me', () => {
  it('returns 401 when not signed in', async () => {
    const response = await adminMeHandler(request());
    expect(response.status).toBe(401);
  });

  it('returns the signed-in admin', async () => {
    const response = await adminMeHandler(
      request({ userId: 'u1', userDetails: 'anna@example.com', identityProvider: 'aad', userRoles: ['authenticated'] }),
    );
    expect(response.status ?? 200).toBe(200);
    expect(response.jsonBody).toEqual({ displayName: 'anna@example.com', identityProvider: 'aad' });
  });
});
