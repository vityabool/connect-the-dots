import type { TimerAction, TimerState } from '@ctd/shared';
import { HttpError } from '../http';
import { bumpVersion, getOwnedGameEntity, timerOf, type Deps } from './games';

/**
 * Admin: starts, pauses or resets the game countdown. The end time is kept on the server, so every
 * screen shows the same time no matter when it joined.
 */
export async function controlTimer(
  deps: Deps,
  ownerId: string,
  gameId: string,
  action: unknown,
): Promise<TimerState> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  const now = deps.now();
  const current = timerOf(game, now);

  let changes: Record<string, string | number> | undefined;
  switch (action as TimerAction) {
    case 'start':
      if (current.state === 'running') return current;
      changes = {
        timerState: 'running',
        timerEndsAt: new Date(now.getTime() + current.remainingSec * 1000).toISOString(),
        timerRemainingSec: 0,
      };
      break;
    case 'pause':
      if (current.state !== 'running') return current;
      changes = { timerState: 'paused', timerEndsAt: '', timerRemainingSec: current.remainingSec };
      break;
    case 'reset':
      changes = { timerState: 'idle', timerEndsAt: '', timerRemainingSec: 0 };
      break;
    default:
      throw new HttpError(400, 'action must be start, pause or reset');
  }

  const updated = await bumpVersion(deps, game, changes);
  return timerOf(updated, now);
}
