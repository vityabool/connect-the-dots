import type { Participant } from '@ctd/shared';

/** What a player's phone remembers between visits (browser local storage; optional). */
export interface Session {
  token: string;
  gameName: string;
  participants: Participant[];
  /** Set after the player picked their name. */
  me?: Participant;
}

const KEY = 'ctd.session';

// Fallback for browsers that block storage (private mode): lasts until the page is reloaded.
let memory: Session | undefined;

export function loadSession(): Session | undefined {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Session;
    return typeof parsed.token === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveSession(session: Session): void {
  memory = session;
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // keep the in-memory copy only
  }
}

export function clearSession(): void {
  memory = undefined;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
