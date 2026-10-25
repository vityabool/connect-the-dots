import { describe, expect, it } from 'vitest';
import { createGame } from './games';
import { createShortLink, SHORT_LINK_UNAVAILABLE, siteOrigin } from './shortLink';
import { makeDeps } from './testing';

const OWNER = 'owner-anna';
const OTHER = 'owner-bob';

async function setup() {
  const ctx = makeDeps({ codes: ['123456'] });
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  return { ...ctx, gameId: game.id };
}

function reply(body: unknown, ok = true) {
  return async () => ({ ok, json: async () => body });
}

describe('createShortLink', () => {
  it('asks is.gd for the join page of the game and returns the link without https://', async () => {
    const { deps, gameId } = await setup();
    const urls: string[] = [];
    const result = await createShortLink(deps, OWNER, gameId, 'https://www.connect-the-dots.top', async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ shorturl: 'https://is.gd/aB3_x9' }) };
    });
    expect(result).toEqual({ shortUrl: 'is.gd/aB3_x9' });
    expect(urls).toEqual([
      `https://is.gd/create.php?format=json&url=${encodeURIComponent('https://www.connect-the-dots.top/join/123456')}`,
    ]);
  });

  it.each([
    ['an is.gd error', { errorcode: 3, errormessage: 'Rate limit exceeded' }],
    ['an unexpected address', { shorturl: 'https://evil.example/x' }],
    ['no body', {}],
  ])('answers with one friendly message for %s', async (_name, body) => {
    const { deps, gameId } = await setup();
    await expect(createShortLink(deps, OWNER, gameId, 'https://example.com', reply(body))).rejects.toMatchObject({
      status: 502,
      message: SHORT_LINK_UNAVAILABLE,
    });
  });

  it('answers with the same message when is.gd cannot be reached or sends something that is not JSON', async () => {
    const { deps, gameId } = await setup();
    const down = async () => {
      throw new Error('ECONNREFUSED');
    };
    const html = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(createShortLink(deps, OWNER, gameId, 'https://example.com', down)).rejects.toMatchObject({ status: 502, message: SHORT_LINK_UNAVAILABLE });
    await expect(createShortLink(deps, OWNER, gameId, 'https://example.com', html)).rejects.toMatchObject({ status: 502, message: SHORT_LINK_UNAVAILABLE });
  });

  it("does not call is.gd for somebody else's game", async () => {
    const { deps, gameId } = await setup();
    let called = false;
    const spy = async () => {
      called = true;
      return { ok: true, json: async () => ({ shorturl: 'https://is.gd/abc' }) };
    };
    await expect(createShortLink(deps, OTHER, gameId, 'https://example.com', spy)).rejects.toMatchObject({ status: 404 });
    expect(called).toBe(false);
  });
});

describe('siteOrigin', () => {
  const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

  it('uses the forwarded host, then the host, with https', () => {
    expect(siteOrigin(headers({ 'x-forwarded-host': 'www.connect-the-dots.top', host: 'internal:7071' }))).toBe('https://www.connect-the-dots.top');
    expect(siteOrigin(headers({ host: 'preview-12.azurestaticapps.net' }))).toBe('https://preview-12.azurestaticapps.net');
  });

  it('prefers the configured public address, so a platform host that is.gd refuses is never used', () => {
    const platformHost = headers({ 'x-forwarded-host': 'thankful-wave-0bdc10d0f.6.azurestaticapps.net' });
    expect(siteOrigin(platformHost, 'https://www.connect-the-dots.top')).toBe('https://www.connect-the-dots.top');
    expect(siteOrigin(platformHost, ' https://www.connect-the-dots.top/ ')).toBe('https://www.connect-the-dots.top');
  });

  it('ignores a configured value that is not a plain address', () => {
    const host = headers({ host: 'www.connect-the-dots.top' });
    expect(siteOrigin(host, '')).toBe('https://www.connect-the-dots.top');
    expect(siteOrigin(host, 'www.example.com/path')).toBe('https://www.connect-the-dots.top');
    expect(siteOrigin(host, 'javascript:alert(1)')).toBe('https://www.connect-the-dots.top');
  });

  it('uses http for a local machine', () => {
    expect(siteOrigin(headers({ host: 'localhost:5173' }))).toBe('http://localhost:5173');
  });

  it('rejects a host that is not a plain host name', () => {
    expect(() => siteOrigin(headers({ host: 'a.com/evil?x=' }))).toThrow();
    expect(() => siteOrigin(headers({}))).toThrow();
  });
});
