import { createHmac, timingSafeEqual } from 'node:crypto';

/** What a player token proves: which game, and (after picking a name) which participant. */
export interface PlayerClaims {
  gameId: string;
  participantId?: string;
}

const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/** Shorter secrets are refused: they are too easy to guess for a key that signs every player token. */
export const MIN_SECRET_LENGTH = 32;

/** The configured signing secret, or an error when it is missing or too short to be safe. */
export function requireSigningSecret(value: string | undefined): string {
  if (!value) throw new Error('TOKEN_SIGNING_SECRET is not configured');
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`TOKEN_SIGNING_SECRET must be at least ${MIN_SECRET_LENGTH} characters (try: openssl rand -base64 48)`);
  }
  return value;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

/** Creates a signed token: base64url(payload) + "." + base64url(HMAC-SHA256). */
export function signPlayerToken(claims: PlayerClaims, secret: string, now: Date): string {
  const payload = base64url(
    JSON.stringify({ g: claims.gameId, p: claims.participantId, e: now.getTime() + TOKEN_LIFETIME_MS }),
  );
  return `${payload}.${base64url(signature(payload, secret))}`;
}

/** Returns the claims, or null when the token is malformed, forged or too old. */
export function verifyPlayerToken(token: string | null | undefined, secret: string, now: Date): PlayerClaims | null {
  if (!token) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;

  const expected = signature(payload, secret);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      g?: unknown;
      p?: unknown;
      e?: unknown;
    };
    if (typeof data.g !== 'string' || typeof data.e !== 'number' || data.e <= now.getTime()) return null;
    const claims: PlayerClaims = { gameId: data.g };
    if (typeof data.p === 'string') claims.participantId = data.p;
    return claims;
  } catch {
    return null;
  }
}
