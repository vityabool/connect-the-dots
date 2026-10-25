import {
  LIMITS,
  connectionKey,
  nameKey,
  parseNameList,
  shortenName,
  type AddTopicsResult,
  type DeleteTopicResult,
  type MergeTopicsResult,
  type Topic,
} from '@ctd/shared';
import { HttpError } from '../http';
import { ConflictError } from '../storage/tables';
import { bumpVersion, getOwnedGameEntity, listTopics, type Deps } from './games';

/** Normalizes and validates a topic name typed by a person. A name that is too long is shortened, ending with "…". */
export function cleanTopicName(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Topic name is required');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, 'Topic name is required');
  return shortenName(name, LIMITS.maxTopicNameLength);
}

/**
 * Returns the topic with this name (matched case-insensitively), creating it when it does not exist.
 * The topic id is derived from the name, so concurrent creations of the same topic cannot duplicate it.
 */
export async function getOrCreateTopic(
  deps: Deps,
  gameId: string,
  rawName: unknown,
  createdBy: string,
): Promise<Topic> {
  const name = cleanTopicName(rawName);
  const id = nameKey(name);

  const existing = await deps.tables.get('Topics', gameId, id);
  if (existing) return { id, name: String(existing.name) };

  if ((await listTopics(deps, gameId)).length >= LIMITS.maxTopics) {
    throw new HttpError(400, `A game can have at most ${LIMITS.maxTopics} topics`);
  }
  try {
    await deps.tables.insert('Topics', {
      partitionKey: gameId,
      rowKey: id,
      name,
      createdBy,
      createdAt: deps.now().toISOString(),
    });
    return { id, name };
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    const winner = await deps.tables.get('Topics', gameId, id);
    return { id, name: String(winner?.name ?? name) };
  }
}

/** Admin: adds starter topics from text (one per line) or a list. Duplicates are skipped silently. */
export async function addTopics(
  deps: Deps,
  ownerId: string,
  gameId: string,
  input: { text?: unknown; names?: unknown },
): Promise<AddTopicsResult> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);

  let text: string;
  if (typeof input.text === 'string') text = input.text;
  else if (Array.isArray(input.names) && input.names.every((n) => typeof n === 'string')) text = input.names.join('\n');
  else throw new HttpError(400, 'Provide "text" (one topic per line) or "names"');

  const existing = await listTopics(deps, gameId);
  // A line that is too long is not rejected: it is shortened and ends with "…".
  const parsed = parseNameList(
    text,
    existing.map((t) => t.name),
    { shortenTo: LIMITS.maxTopicNameLength },
  );
  const valid = parsed.names;
  if (existing.length + valid.length > LIMITS.maxTopics) {
    throw new HttpError(400, `A game can have at most ${LIMITS.maxTopics} topics`);
  }

  const added: Topic[] = [];
  let duplicatesSkipped = parsed.duplicatesSkipped;
  for (const name of valid) {
    const id = nameKey(name);
    try {
      await deps.tables.insert('Topics', {
        partitionKey: gameId,
        rowKey: id,
        name,
        createdBy: 'admin',
        createdAt: deps.now().toISOString(),
      });
      added.push({ id, name });
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      duplicatesSkipped += 1;
    }
  }
  if (added.length > 0) await bumpVersion(deps, game);
  added.sort((a, b) => a.name.localeCompare(b.name));
  return { added, duplicatesSkipped, shortened: parsed.shortened };
}

/** Admin: deletes a topic together with every connection made on it. */
export async function deleteTopic(
  deps: Deps,
  ownerId: string,
  gameId: string,
  topicId: string,
): Promise<DeleteTopicResult> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  const topic = await deps.tables.get('Topics', gameId, topicId);
  if (!topic) throw new HttpError(404, 'Topic not found');

  let deletedConnections = 0;
  for (const row of await deps.tables.list('Connections', gameId)) {
    if (row.topicId === topicId) {
      await deps.tables.delete('Connections', gameId, row.rowKey);
      deletedConnections += 1;
    }
  }
  await deps.tables.delete('Topics', gameId, topicId);
  await bumpVersion(deps, game);
  return { deletedConnections };
}

/**
 * Admin: merges the source topic into the target topic. Every connection of the source moves to
 * the target; a pair that is already connected on the target keeps just one connection.
 */
export async function mergeTopics(
  deps: Deps,
  ownerId: string,
  gameId: string,
  sourceId: unknown,
  targetId: unknown,
): Promise<MergeTopicsResult> {
  const game = await getOwnedGameEntity(deps, ownerId, gameId);
  if (typeof sourceId !== 'string' || typeof targetId !== 'string') {
    throw new HttpError(400, 'Choose the topic to merge into');
  }
  if (sourceId === targetId) throw new HttpError(400, 'Choose a different topic to merge into');
  const [source, target] = await Promise.all([
    deps.tables.get('Topics', gameId, sourceId),
    deps.tables.get('Topics', gameId, targetId),
  ]);
  if (!source || !target) throw new HttpError(404, 'Topic not found');

  let moved = 0;
  let duplicatesDropped = 0;
  for (const row of await deps.tables.list('Connections', gameId)) {
    if (row.topicId !== sourceId) continue;
    const rowKey = connectionKey(String(row.aId), String(row.bId), targetId);
    try {
      // Insert first, delete after: a crash in between never loses a connection.
      await deps.tables.insert('Connections', { ...row, rowKey, topicId: targetId });
      moved += 1;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      duplicatesDropped += 1;
    }
    await deps.tables.delete('Connections', gameId, row.rowKey);
  }
  await deps.tables.delete('Topics', gameId, sourceId);
  await bumpVersion(deps, game);
  return { moved, duplicatesDropped };
}
