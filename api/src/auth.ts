/** The signed-in admin as described by Azure Static Web Apps in the `x-ms-client-principal` header. */
export interface Principal {
  userId: string;
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
}

/**
 * Decodes the `x-ms-client-principal` header (base64 JSON) added by Static Web Apps after sign-in.
 * Returns null when the header is missing, malformed, or the user is not authenticated.
 * Requests to /api/* go through Static Web Apps, which sets this header itself and ignores any
 * value supplied by the client.
 */
export function parsePrincipal(header: string | null | undefined): Principal | null {
  if (!header) return null;
  try {
    const raw = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Partial<Principal>;
    if (typeof raw.userId !== 'string' || raw.userId.length === 0) return null;
    const roles = Array.isArray(raw.userRoles) ? raw.userRoles.filter((r) => typeof r === 'string') : [];
    if (!roles.includes('authenticated')) return null;
    return {
      userId: raw.userId,
      userDetails: typeof raw.userDetails === 'string' ? raw.userDetails : '',
      identityProvider: typeof raw.identityProvider === 'string' ? raw.identityProvider : '',
      userRoles: roles,
    };
  } catch {
    return null;
  }
}
