import type { TimerState } from '@ctd/shared';
import { useEffect, useState } from 'react';

export interface Countdown {
  /** Whole seconds left (never below 0). */
  remainingSec: number;
  state: TimerState['state'];
  /** True once a running timer reached zero. */
  timeUp: boolean;
}

/**
 * Turns the server's timer state into a ticking countdown. The server sends the seconds left at
 * the moment it answered; this counts down from there with the browser clock, so the screen needs
 * no extra requests and stays in step with every other screen.
 */
export function useCountdown(timer: TimerState | undefined, receivedAt: number | undefined): Countdown {
  const [now, setNow] = useState(() => Date.now());
  const running = timer?.state === 'running';

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  if (!timer) return { remainingSec: 0, state: 'idle', timeUp: false };
  if (!running) return { remainingSec: timer.remainingSec, state: timer.state, timeUp: false };

  const elapsed = Math.max(0, Math.floor((Math.max(now, receivedAt ?? now) - (receivedAt ?? now)) / 1000));
  const remainingSec = Math.max(0, timer.remainingSec - elapsed);
  return { remainingSec, state: 'running', timeUp: remainingSec === 0 };
}

/** 1800 -> "30:00", 65 -> "1:05", 3725 -> "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}
