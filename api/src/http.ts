import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parsePrincipal, type Principal } from './auth';

/** An error that is safe to show to the caller. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Returns the signed-in admin or throws 401. */
export function requireAdmin(request: HttpRequest): Principal {
  const principal = parsePrincipal(request.headers.get('x-ms-client-principal'));
  if (!principal) throw new HttpError(401, 'Not signed in');
  return principal;
}

/** Reads the JSON body of a request; throws 400 for missing or invalid JSON. */
export async function readJson(request: HttpRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Request body must be a JSON object');
}

/**
 * Best-effort client address for rate limiting, from the `x-forwarded-for` header that Static Web Apps sets.
 * Takes the first address, drops a port ("1.2.3.4:5555" or "[::1]:5555"), and keeps only characters that are
 * safe in a Table Storage key, so an odd header value can never cause an error.
 */
export function clientAddress(request: HttpRequest): string {
  const first = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
  const bracketed = first.match(/^\[(.+)\](?::\d+)?$/);
  const ipv4WithPort = first.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  const address = bracketed?.[1] ?? ipv4WithPort?.[1] ?? first;
  const safe = address.replace(/[^A-Za-z0-9:._-]/g, '_').slice(0, 64);
  return safe || 'unknown';
}

/** The `?since=<version>` poll parameter, or undefined when absent or not a whole number. */
export function sinceParam(request: HttpRequest): number | undefined {
  const raw = request.query.get('since');
  if (raw === null || !/^\d{1,16}$/.test(raw)) return undefined;
  return Number(raw);
}

type Handler = (request: HttpRequest, context: InvocationContext) => Promise<unknown>;

/**
 * Wraps a handler: returns its result as JSON (204 for undefined), and turns HttpError into the
 * matching status. Unexpected errors are logged and returned as a generic 500.
 */
export function json(handler: Handler) {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const result = await handler(request, context);
      if (result === undefined) return { status: 204 };
      return { status: 200, jsonBody: result };
    } catch (error) {
      if (error instanceof HttpError) return { status: error.status, jsonBody: { error: error.message } };
      context.error('Unhandled error', error);
      return { status: 500, jsonBody: { error: 'Something went wrong' } };
    }
  };
}
