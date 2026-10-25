import { describe, expect, it } from 'vitest';
import { MIN_SECRET_LENGTH, requireSigningSecret, signPlayerToken, verifyPlayerToken } from './playerToken';

const SECRET = 'test-secret';
const NOW = new Date('2026-10-17T10:00:00Z');

describe('signing secret check', () => {
  it('refuses a missing or empty secret', () => {
    expect(() => requireSigningSecret(undefined)).toThrow('not configured');
    expect(() => requireSigningSecret('')).toThrow('not configured');
  });

  it('refuses a secret shorter than the minimum', () => {
    expect(() => requireSigningSecret('a'.repeat(MIN_SECRET_LENGTH - 1))).toThrow(`at least ${MIN_SECRET_LENGTH} characters`);
  });

  it('accepts a secret of the minimum length or longer and returns it unchanged', () => {
    const exact = 'a'.repeat(MIN_SECRET_LENGTH);
    expect(requireSigningSecret(exact)).toBe(exact);
    const long = 'b'.repeat(64);
    expect(requireSigningSecret(long)).toBe(long);
  });

  it('accepts the secret in the example settings file, so a fresh checkout works', async () => {
    const { readFileSync } = await import('node:fs');
    const example = JSON.parse(readFileSync(new URL('../local.settings.json.example', import.meta.url), 'utf8')) as {
      Values: { TOKEN_SIGNING_SECRET: string };
    };
    expect(() => requireSigningSecret(example.Values.TOKEN_SIGNING_SECRET)).not.toThrow();
  });
});

describe('player tokens', () => {
  it('round-trips game-only and identified claims', () => {
    const joined = signPlayerToken({ gameId: 'g1' }, SECRET, NOW);
    expect(verifyPlayerToken(joined, SECRET, NOW)).toEqual({ gameId: 'g1' });

    const identified = signPlayerToken({ gameId: 'g1', participantId: 'p1' }, SECRET, NOW);
    expect(verifyPlayerToken(identified, SECRET, NOW)).toEqual({ gameId: 'g1', participantId: 'p1' });
  });

  it('rejects a token signed with another secret', () => {
    const token = signPlayerToken({ gameId: 'g1' }, 'other-secret', NOW);
    expect(verifyPlayerToken(token, SECRET, NOW)).toBeNull();
  });

  it('rejects a token whose payload was tampered with', () => {
    const token = signPlayerToken({ gameId: 'g1' }, SECRET, NOW);
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ g: 'g2', e: NOW.getTime() + 1e9 })).toString('base64url');
    expect(verifyPlayerToken(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = signPlayerToken({ gameId: 'g1' }, SECRET, NOW);
    const later = new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(verifyPlayerToken(token, SECRET, later)).toBeNull();
  });

  it('rejects garbage', () => {
    for (const bad of [undefined, null, '', 'abc', 'a.b.c', '...', 'not.a-token']) {
      expect(verifyPlayerToken(bad, SECRET, NOW)).toBeNull();
    }
  });
});
