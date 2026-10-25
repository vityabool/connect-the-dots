import { DEFAULT_TOPICS, LIMITS } from '@ctd/shared';
import { describe, expect, it } from 'vitest';
import { createGame, getGame } from './games';
import { makeDeps } from './testing';
import { addTopics, cleanTopicName, getOrCreateTopic } from './topics';

const OWNER = 'owner-anna';
const OTHER = 'owner-bob';

async function setup() {
  const ctx = makeDeps();
  const game = await createGame(ctx.deps, OWNER, 'Offsite');
  return { ...ctx, gameId: game.id };
}

describe('addTopics (admin)', () => {
  it('adds starter topics from text and skips duplicates silently', async () => {
    const { deps, gameId } = await setup();
    const result = await addTopics(deps, OWNER, gameId, { text: 'Have dogs\n\nPlay tennis\nhave   DOGS' });
    expect(result.added.map((t) => t.name)).toEqual(['Have dogs', 'Play tennis']);
    expect(result.duplicatesSkipped).toBe(1);

    const again = await addTopics(deps, OWNER, gameId, { names: ['Play Tennis', 'Chess'] });
    expect(again.added.map((t) => t.name)).toEqual(['Chess']);
    expect(again.duplicatesSkipped).toBe(1);
    const names = (await getGame(deps, OWNER, gameId)).topics.map((t) => t.name);
    expect(names).toHaveLength(DEFAULT_TOPICS.length + 3); // the defaults and these three
    expect(names).toEqual(expect.arrayContaining(['Chess', 'Have dogs', 'Play tennis']));
  });

  it('shortens an over-long topic with "…" instead of refusing it', async () => {
    const { deps, gameId } = await setup();
    const long = 'A very long topic name that does not fit';
    const result = await addTopics(deps, OWNER, gameId, { text: `${long}\nChess` });
    expect(result.added.map((t) => t.name).sort()).toEqual(['A very long topic name that d…', 'Chess']);
    for (const topic of result.added) expect(topic.name.length).toBeLessThanOrEqual(LIMITS.maxTopicNameLength);
    expect(result.shortened).toBe(1);
    expect(result.duplicatesSkipped).toBe(0);

    // The same long line again is recognised as the topic that exists, not added a second time.
    const again = await addTopics(deps, OWNER, gameId, { text: long });
    expect(again.added).toEqual([]);
    expect(again.duplicatesSkipped).toBe(1);
    expect(again.shortened).toBe(1);
  });

  it('validates input', async () => {
    const { deps, gameId } = await setup();
    await expect(addTopics(deps, OWNER, gameId, {})).rejects.toMatchObject({ status: 400 });
  });

  it('only works for the owner', async () => {
    const { deps, gameId } = await setup();
    await expect(addTopics(deps, OTHER, gameId, { text: 'Chess' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('getOrCreateTopic', () => {
  it('returns the same topic for names that differ in case and spacing', async () => {
    const { deps, gameId } = await setup();
    const a = await getOrCreateTopic(deps, gameId, 'Rock climbing', 'p1');
    const b = await getOrCreateTopic(deps, gameId, '  rock   CLIMBING ', 'p2');
    expect(b).toEqual(a);
    expect((await getGame(deps, OWNER, gameId)).topics).toHaveLength(DEFAULT_TOPICS.length + 1);
  });

  it('refuses the 201st topic', async () => {
    const { deps, gameId } = await setup();
    await addTopics(deps, OWNER, gameId, { names: Array.from({ length: LIMITS.maxTopics - DEFAULT_TOPICS.length }, (_, i) => `Topic ${i}`) });
    await expect(getOrCreateTopic(deps, gameId, 'One more', 'p1')).rejects.toMatchObject({ status: 400 });
  });
});

describe('cleanTopicName', () => {
  it('trims, collapses spaces and shortens names that are too long', () => {
    expect(cleanTopicName('  Have   dogs ')).toBe('Have dogs');
    expect(() => cleanTopicName('')).toThrow();
    expect(() => cleanTopicName(5)).toThrow();
    expect(cleanTopicName('x'.repeat(LIMITS.maxTopicNameLength))).toBe('x'.repeat(30));
    expect(cleanTopicName('x'.repeat(LIMITS.maxTopicNameLength + 1))).toBe(`${'x'.repeat(29)}…`);
  });

  it('shortens a topic a player creates on the fly', async () => {
    const { deps, gameId } = await setup();
    const topic = await getOrCreateTopic(deps, gameId, 'Visited a very remote and unusually beautiful place', 'p1');
    expect(topic.name).toHaveLength(30);
    expect(topic.name.endsWith('…')).toBe(true);
  });
});
