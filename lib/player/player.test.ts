import { Sender } from '@/types/playthrough';
import { EntryType, Schema } from '@/types/schema';
import { describe, expect, it } from 'vitest';
import { constructSceneMap, handleInput, step } from './utils/index';

/**
 * Test schema representing:
 *
 * # HOME (implicit START)
 * The fire burns brightly.
 * ~ Ride a bike
 *    That's cool!
 *    > BIKE
 * ~ Run away
 *    Weirdo…
 *    > END
 *
 * # BIKE
 * Learn to sail
 * > END
 */
const testSchema: Schema = [
  // START / HOME scene
  { type: EntryType.NARRATIVE, text: 'The fire burns brightly.' },
  {
    type: EntryType.OPTION,
    text: 'Ride a bike',
    then: [
      { type: EntryType.NARRATIVE, text: "That's cool!" },
      { type: EntryType.JUMP, target: 'BIKE' },
    ],
  },
  {
    type: EntryType.OPTION,
    text: 'Run away',
    then: [
      { type: EntryType.NARRATIVE, text: 'Weirdo…' },
      { type: EntryType.JUMP, target: 'END' },
    ],
  },
  // BIKE scene
  { type: EntryType.SCENE, label: 'BIKE' },
  { type: EntryType.NARRATIVE, text: 'Learn to sail' },
  { type: EntryType.JUMP, target: 'END' },
];

describe('Player Flow', () => {
  it('should step through narrative lines and wait at options', () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    // First step: get the first narrative line
    const move1 = step({ schema: testSchema, sceneMap, sceneId: 'START', lineIdx: 0 });
    expect(move1.type).toBe('continue');
    expect(move1.line?.text).toBe('The fire burns brightly.');
    expect(move1.line?.sender).toBe(Sender.NARRATOR);

    // Second step: should wait for input (options available)
    const move2 = step({ schema: testSchema, sceneMap, sceneId: 'START', lineIdx: 1 });
    expect(move2.type).toBe('wait');
  });

  it('should fuzzy match player input "Bike" to "Ride a bike" option', async () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    // Player is at lineIdx 1 (after the first narrative), waiting for input
    const result = await handleInput({
      input: 'Bike',
      schema: testSchema,
      sceneMap,
      sceneId: 'START',
      lineIdx: 1,
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.sceneId).toBe('BIKE');
    expect(result.lineIdx).toBe(0);
    expect(result.optionText).toBe('Ride a bike');
  });

  it('should fuzzy match "run" to "Run away" option', async () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    const result = await handleInput({
      input: 'run',
      schema: testSchema,
      sceneMap,
      sceneId: 'START',
      lineIdx: 1,
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.sceneId).toBe('END');
    expect(result.optionText).toBe('Run away');
  });

  it('should continue in BIKE scene after matching bike option', () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    // After matching "Bike", we're now in BIKE scene at lineIdx 0
    const move = step({ schema: testSchema, sceneMap, sceneId: 'BIKE', lineIdx: 0 });

    expect(move.type).toBe('continue');
    expect(move.line?.text).toBe('Learn to sail');
  });

  it('should end after BIKE scene narrative', () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    // After "Learn to sail", next step should hit the jump to END
    const move = step({ schema: testSchema, sceneMap, sceneId: 'BIKE', lineIdx: 1 });

    expect(move.type).toBe('end');
  });

  it('should match case-insensitively: "RIDE A BIKE" matches "Ride a bike"', async () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    const result = await handleInput({
      input: 'RIDE A BIKE',
      schema: testSchema,
      sceneMap,
      sceneId: 'START',
      lineIdx: 1,
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.sceneId).toBe('BIKE');
  });

  it('should pick option with most keyword matches', async () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    // "ride bike" has 2 matches with "Ride a bike", vs 0 with "Run away"
    const result = await handleInput({
      input: 'ride bike',
      schema: testSchema,
      sceneMap,
      sceneId: 'START',
      lineIdx: 1,
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.optionText).toBe('Ride a bike');
  });

  it('should return narratives from option then block for "Ride a bike"', async () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    const result = await handleInput({
      input: 'Bike',
      schema: testSchema,
      sceneMap,
      sceneId: 'START',
      lineIdx: 1,
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.narratives).toHaveLength(1);
    expect(result.narratives?.[0].text).toBe("That's cool!");
  });

  it('should return narratives from option then block for "Run away"', async () => {
    const sceneMap = constructSceneMap({ schema: testSchema });

    const result = await handleInput({
      input: 'run',
      schema: testSchema,
      sceneMap,
      sceneId: 'START',
      lineIdx: 1,
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.narratives).toHaveLength(1);
    expect(result.narratives?.[0].text).toBe('Weirdo…');
  });
});
