import { LIMITS, nameKey, parseNameList, type AddParticipantsResult, type Participant } from '@ctd/shared';
import { HttpError } from '../http';
import { ConflictError } from '../storage/tables';
import { bumpVersion, getOwnedGameEntity, listParticipants, type Deps } from './games';

/**
 * Adds participants from a .txt style list (one name per line) or an array of names.
 * Names are unique per game (case-insensitive); duplicates are skipped silently.
 */
export async function addParticipants(
  deps: Deps,
  ownerId: string,
  gameId: string,
  input: { text?: unknown; names?: unknown },
): Promise<AddParticipantsResult> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);

  let text: string;
  if (typeof input.text === 'string') text = input.text;
  else if (Array.isArray(input.names) && input.names.every((n) => typeof n === 'string')) text = input.names.join('\n');
  else throw new HttpError(400, 'Provide "text" (one name per line) or "names"');

  const existing = await listParticipants(deps, gameId);
  const parsed = parseNameList(
    text,
    existing.map((p) => p.name),
  );

  const valid = parsed.names.filter((name) => name.length <= LIMITS.maxNameLength);
  const tooLongSkipped = parsed.names.length - valid.length;

  if (existing.length + valid.length > LIMITS.maxParticipants) {
    throw new HttpError(400, `A game can have at most ${LIMITS.maxParticipants} participants`);
  }

  const added: Participant[] = [];
  let duplicatesSkipped = parsed.duplicatesSkipped;
  for (const name of valid) {
    const id = nameKey(name);
    try {
      await deps.tables.insert('Participants', { partitionKey: gameId, rowKey: id, name });
      added.push({ id, name });
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      duplicatesSkipped += 1;
    }
  }

  if (added.length > 0) await bumpVersion(deps, game);
  added.sort((a, b) => a.name.localeCompare(b.name));
  return { added, duplicatesSkipped, tooLongSkipped };
}

/** Removes a participant together with every connection they are part of. */
export async function deleteParticipant(
  deps: Deps,
  ownerId: string,
  gameId: string,
  participantId: string,
): Promise<void> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  const participant = await deps.tables.get('Participants', gameId, participantId);
  if (!participant) throw new HttpError(404, 'Participant not found');

  const connections = await deps.tables.list('Connections', gameId);
  for (const connection of connections) {
    if (connection.aId === participantId || connection.bId === participantId) {
      await deps.tables.delete('Connections', gameId, connection.rowKey);
    }
  }
  await deps.tables.delete('Participants', gameId, participantId);
  await bumpVersion(deps, game);
}
