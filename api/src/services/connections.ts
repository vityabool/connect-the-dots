import { HttpError } from '../http';
import { bumpVersion, getOwnedGameEntity, type Deps } from './games';

/** Admin: deletes any connection of one of their games. */
export async function adminDeleteConnection(
  deps: Deps,
  ownerId: string,
  gameId: string,
  connectionId: string,
): Promise<void> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  const row = await deps.tables.get('Connections', gameId, connectionId);
  if (!row) throw new HttpError(404, 'Connection not found');
  await deps.tables.delete('Connections', gameId, connectionId);
  await bumpVersion(deps, game);
}
