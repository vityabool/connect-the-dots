import { MemoryTables } from '../storage/memoryTables';
import type { Deps } from './games';

/** Test helper: deps backed by memory with a controllable clock and scripted game codes. */
export function makeDeps(options: { codes?: string[]; start?: string } = {}) {
  const clock = { time: new Date(options.start ?? '2026-10-17T10:00:00Z') };
  const codes = [...(options.codes ?? [])];
  let counter = 0;
  const tables = new MemoryTables();
  const deps: Deps = {
    tables,
    now: () => new Date(clock.time),
    randomCode: () => codes.shift() ?? String(100000 + counter).padStart(6, '0'),
    newId: () => {
      counter += 1;
      return counter.toString(16).padStart(32, '0');
    },
  };
  return {
    deps,
    tables,
    advanceDays(days: number) {
      clock.time = new Date(clock.time.getTime() + days * 24 * 60 * 60 * 1000);
    },
  };
}
