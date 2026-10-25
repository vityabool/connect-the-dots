import { describe, expect, it } from 'vitest';
import { parsePrincipal } from './auth';

function header(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

describe('parsePrincipal', () => {
  it('reads a signed-in Microsoft user', () => {
    const principal = parsePrincipal(
      header({
        userId: 'abc123',
        userDetails: 'anna@example.com',
        identityProvider: 'aad',
        userRoles: ['anonymous', 'authenticated'],
      }),
    );
    expect(principal).toEqual({
      userId: 'abc123',
      userDetails: 'anna@example.com',
      identityProvider: 'aad',
      userRoles: ['anonymous', 'authenticated'],
    });
  });

  it('returns null when there is no header', () => {
    expect(parsePrincipal(undefined)).toBeNull();
    expect(parsePrincipal(null)).toBeNull();
    expect(parsePrincipal('')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parsePrincipal('not-base64-json')).toBeNull();
  });

  it('returns null when the user is not authenticated', () => {
    expect(parsePrincipal(header({ userId: 'x', userRoles: ['anonymous'] }))).toBeNull();
  });

  it('returns null when the user id is missing', () => {
    expect(parsePrincipal(header({ userRoles: ['authenticated'] }))).toBeNull();
  });
});
