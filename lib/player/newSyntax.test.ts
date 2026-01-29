import { describe, expect, it } from 'vitest';
import { parseIntoSchema } from '../project/parser';
import { constructSceneMap } from './utils/constructSceneMap';
import { matchInput } from './utils/matchInput';
import { step } from './utils/step';

/**
 * Test the new syntax:
 * - `+key` standalone line to set a variable
 * - `-key` standalone line to unset a variable
 * - `& ?key` on a choice to require a variable
 */

const NEW_SYNTAX_SCRIPT = `
@HOME
+bike
The fire burns brightly.
if ride a bike & ?bike
    That's cool!
    goto @BIKE
if grab the fire
    +fire
    Ouch!
@BIKE
when [fire]
    You are biking with fire in your hands.
You feel the wind in your hair.
goto @END
`
  .trim()
  .split('\n');

describe('New syntax tests', () => {
  const schema = parseIntoSchema(NEW_SYNTAX_SCRIPT);
  const sceneMap = constructSceneMap({ schema });

  it('should parse +bike as a standalone set variable', () => {
    const variables = new Set<string>();
    const callbacks = {
      setVariable: (v: string) => variables.add(v),
      unsetVariable: (v: string) => variables.delete(v),
      hasVariable: (v: string) => variables.has(v),
    };

    // First step should set bike variable
    const result = step({ schema, sceneMap, sceneId: 'HOME', lineIdx: 0, callbacks });

    expect(variables.has('bike')).toBe(true);
    expect(result.type).toBe('continue');
    expect(result.line?.text).toBe('The fire burns brightly.');
  });

  it('should make "ride a bike" available only when bike variable is set', async () => {
    // Without bike variable
    const resultWithout = await matchInput({
      input: 'ride a bike',
      schema,
      sceneMap,
      sceneId: 'HOME',
      lineIdx: 1, // After the narrative
      hasVariable: () => false,
      useFuzzyFallback: false,
    });
    expect(resultWithout.matched).toBe(false);

    // With bike variable
    const resultWith = await matchInput({
      input: 'ride a bike',
      schema,
      sceneMap,
      sceneId: 'HOME',
      lineIdx: 1,
      hasVariable: (v) => v === 'bike',
      useFuzzyFallback: false,
    });
    expect(resultWith.matched).toBe(true);
    expect(resultWith.sceneId).toBe('BIKE');
  });

  it('should set fire variable when grabbing the fire', async () => {
    const variables = new Set<string>();

    const result = await matchInput({
      input: 'grab the fire',
      schema,
      sceneMap,
      sceneId: 'HOME',
      lineIdx: 1,
      hasVariable: (v) => variables.has(v),
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.metadata).toBeDefined();
    // The +fire should be in the metadata
    const setsMetadata = result.metadata?.find((m) => m.key === 'sets');
    expect(setsMetadata?.value).toBe('fire');
  });

  it('should complete full flow: get bike -> grab fire -> ride bike -> see fire message', () => {
    const variables = new Set<string>();
    const callbacks = {
      setVariable: (v: string) => variables.add(v),
      unsetVariable: (v: string) => variables.delete(v),
      hasVariable: (v: string) => variables.has(v),
    };

    const lines: string[] = [];
    let sceneId = 'HOME';
    let lineIdx = 0;
    let stepCount = 0;
    const maxSteps = 50;

    // Step until wait
    const stepUntilWait = () => {
      while (stepCount < maxSteps) {
        stepCount++;
        const result = step({ schema, sceneMap, sceneId, lineIdx, callbacks });

        if (result.type === 'wait') return 'wait';
        if (result.type === 'end') return 'end';
        if (result.type === 'error') throw new Error(result.line?.text);

        if (result.line) {
          lines.push(result.line.text);
          const match = result.line.id.match(/^(.+)-(\d+)$/);
          if (match) {
            sceneId = match[1];
            lineIdx = parseInt(match[2], 10) + 1;
          }
        }
      }
      throw new Error('Max steps reached');
    };

    // Step through HOME
    stepUntilWait();
    expect(variables.has('bike')).toBe(true);
    expect(lines).toContain('The fire burns brightly.');
  });
});

describe('Unset variable test', () => {
  const UNSET_SCRIPT = `
@HOME
+key
You have a key.
if use the key & ?key
    -key
    The door opens and the key breaks.
    goto @INSIDE
@INSIDE
You are inside now.
`
    .trim()
    .split('\n');

  it('should unset the key variable when using it', async () => {
    const schema = parseIntoSchema(UNSET_SCRIPT);
    const sceneMap = constructSceneMap({ schema });

    const result = await matchInput({
      input: 'use the key',
      schema,
      sceneMap,
      sceneId: 'HOME',
      lineIdx: 1,
      hasVariable: (v) => v === 'key',
      useFuzzyFallback: false,
    });

    expect(result.matched).toBe(true);
    expect(result.sceneId).toBe('INSIDE');

    // Check that -key is in metadata
    const unsetsMetadata = result.metadata?.find((m) => m.key === 'unsets');
    expect(unsetsMetadata?.value).toBe('key');
  });
});
