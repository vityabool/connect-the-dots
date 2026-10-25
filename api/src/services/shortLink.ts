import { HttpError } from '../http';
import { getOwnedGameEntity, type Deps } from './games';

const IS_GD = 'https://is.gd/create.php';
const TIMEOUT_MS = 8000;

/** Shown to the admin for every kind of is.gd failure: the details do not help them. */
export const SHORT_LINK_UNAVAILABLE = 'Sorry, is.gd is not available today.';

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * The address of this site that the short link points to. Normally the `PUBLIC_ORIGIN` setting (for example
 * "https://www.connect-the-dots.top"): is.gd refuses the platform's own *.azurestaticapps.net addresses, which are
 * on its blacklist, and Static Web Apps may pass that host to the API even when the admin used the custom domain.
 * Without the setting it falls back to the host of the request. Never taken from the request body: the endpoint must
 * only ever shorten "<this site>/join/<the admin's own game code>".
 */
export function siteOrigin(headers: { get(name: string): string | null }, configured?: string): string {
  const setting = configured?.trim().replace(/\/$/, '') ?? '';
  if (/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(setting)) return setting;
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0]?.trim() ?? '';
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) throw new HttpError(400, 'Cannot tell which address this site uses');
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  return `${local ? 'http' : 'https'}://${host}`;
}

/**
 * Asks is.gd for a short link to the game's join page (https://is.gd/apishorteningreference.php) and returns it without
 * the "https://" so that it reads well on the big screen. Any failure becomes one short, friendly 502.
 */
export async function createShortLink(
  deps: Deps,
  ownerId: string,
  gameId: string,
  origin: string,
  fetchImpl: Fetch = fetch,
): Promise<{ shortUrl: string }> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  const joinUrl = `${origin}/join/${String(game.code)}`;
  const query = `format=json&url=${encodeURIComponent(joinUrl)}`;
  try {
    const response = await fetchImpl(`${IS_GD}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await response.json()) as { shorturl?: unknown };
    if (typeof body.shorturl === 'string' && /^https:\/\/is\.gd\/[A-Za-z0-9_]+$/.test(body.shorturl)) {
      return { shortUrl: body.shorturl.replace(/^https:\/\//, '') };
    }
  } catch {
    // fall through to the same message
  }
  throw new HttpError(502, SHORT_LINK_UNAVAILABLE);
}
