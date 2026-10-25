import { isUnchanged, type Unchanged } from '@ctd/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveOptions<T> {
  /** Changing the key starts over (for example another game or another player). */
  key: string;
  /** Loads the data, or answers "unchanged" when `since` is still the current version. */
  fetch: (since: number | undefined) => Promise<T | Unchanged>;
  versionOf: (data: T) => number;
  /** True for errors that make polling pointless (game ended, signed out, not found). */
  isFatal?: (error: unknown) => boolean;
  onFatal?: (error: unknown) => void;
  /** Time between polls while the tab is visible. Default 2 s. */
  intervalMs?: number;
  /** Time between polls while the tab is in the background. Default 10 s. */
  hiddenIntervalMs?: number;
  /** A full reload (ignoring the version) at least this often, as a safety net. Default 30 s. */
  fullRefreshMs?: number;
  /** Longest wait between retries after network errors. Default 15 s. */
  maxBackoffMs?: number;
}

export interface Live<T> {
  data: T | undefined;
  /** When (browser clock, ms) the current data arrived; lets countdowns run on without extra requests. */
  receivedAt: number | undefined;
  /** True while the last poll failed (the previous data is kept on screen). */
  offline: boolean;
  /** Reloads immediately, for example right after the user changed something. */
  refresh: () => void;
}

/**
 * Keeps data fresh by polling a cheap "anything new since version N?" endpoint.
 * Polls slower in background tabs, backs off when offline and reloads in full now and then.
 */
export function useLive<T>(options: LiveOptions<T>): Live<T> {
  const [state, setState] = useState<{ key: string; data: T; at: number } | undefined>();
  const [offline, setOffline] = useState(false);

  // Always call the latest callbacks without restarting the polling loop.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const poke = useRef<() => void>(() => undefined);
  const refresh = useCallback(() => poke.current(), []);

  const { key } = options;
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let version: number | undefined;
    let lastFull = 0;
    let failures = 0;
    let running = false;
    let again = false;

    const delay = () => {
      const o = latest.current;
      const base = o.intervalMs ?? 2000;
      if (failures > 0) return Math.min(base * 2 ** failures, o.maxBackoffMs ?? 15000);
      return document.visibilityState === 'hidden' ? (o.hiddenIntervalMs ?? 10000) : base;
    };

    async function tick(force: boolean): Promise<void> {
      if (stopped) return;
      if (running) {
        again = again || force;
        return;
      }
      running = true;
      clearTimeout(timer);
      const o = latest.current;
      try {
        const fullDue = Date.now() - lastFull >= (o.fullRefreshMs ?? 30000);
        const result = await o.fetch(force || fullDue ? undefined : version);
        if (stopped) return;
        failures = 0;
        setOffline(false);
        if (!isUnchanged(result)) {
          version = o.versionOf(result as T);
          lastFull = Date.now();
          setState({ key, data: result as T, at: Date.now() });
        }
      } catch (error) {
        if (stopped) return;
        if (o.isFatal?.(error)) {
          stopped = true;
          o.onFatal?.(error);
          return;
        }
        failures += 1;
        setOffline(true);
      } finally {
        running = false;
      }
      if (stopped) return;
      if (again) {
        again = false;
        void tick(true);
      } else {
        timer = setTimeout(() => void tick(false), delay());
      }
    }

    poke.current = () => void tick(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    void tick(true);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      poke.current = () => undefined;
    };
  }, [key]);

  const current = state?.key === key ? state : undefined;
  return { data: current?.data, receivedAt: current?.at, offline, refresh };
}
