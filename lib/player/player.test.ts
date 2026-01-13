import { describe, expect, it } from 'vitest';
import { parseIntoSchema } from '../project/parser';
import { constructSceneMap } from './utils/constructSceneMap';
import { matchInput } from './utils/matchInput';
import { step } from './utils/step';

const TEST_SCRIPT = `
@HOME
[sets: bike]
[image: https://i.imgur.com/PR6oN9P.png]
You're in a room. You see a chair, a desk, and a plant.
if leave & [key]
  You did it!
  goto @END
if examine the desk | look at desk | what's on the desk | check desk
  [if: !key]
    You lean closer to the desk.
    goto @DESK
  The desk is empty now, just papers scattered about.
@DESK
[if: !key]
  [image: https://i.imgur.com/2Thd6hv.png]
  Oh lookee, there's a key on it. Take it?
if take the key | sure | yes | take key | ok
  Yoink!
  goto @KEY
if You step back from the desk, leaving the key where it is. | don't take it | leave it | nope | skip
   You step back from the desk, leaving the key where it is.
   So... what now?
@KEY
[sets: key]
goto @HOME
`
  .trim()
  .split('\n');

describe('Player flow - desk key scenario', () => {
  const schema = parseIntoSchema(TEST_SCRIPT);
  const sceneMap = constructSceneMap({ schema });

  it('should have correct scene map', () => {
    expect(sceneMap).toHaveProperty('START', 0);
    expect(sceneMap).toHaveProperty('HOME');
    expect(sceneMap).toHaveProperty('DESK');
    expect(sceneMap).toHaveProperty('KEY');
  });

  describe('step function', () => {
    it('should step through HOME scene correctly', () => {
      const variables = new Set<string>();
      const callbacks = {
        setVariable: (v: string) => variables.add(v),
        unsetVariable: (v: string) => variables.delete(v),
        hasVariable: (v: string) => variables.has(v),
      };

      // Step 0: should set bike variable
      let result = step({ schema, sceneMap, sceneId: 'HOME', lineIdx: 0, callbacks });
      expect(variables.has('bike')).toBe(true);

      // Should return image (lineIdx 1 after skipping set)
      expect(result.type).toBe('continue');
      expect(result.line?.type).toBe('image');
    });

    it('should step through KEY scene and return to HOME', () => {
      const variables = new Set<string>();
      const callbacks = {
        setVariable: (v: string) => variables.add(v),
        unsetVariable: (v: string) => variables.delete(v),
        hasVariable: (v: string) => variables.has(v),
      };

      // Start at KEY scene, lineIdx 0
      // KEY has: [sets: key], goto @HOME
      // Should set key variable, then jump to HOME
      let result = step({ schema, sceneMap, sceneId: 'KEY', lineIdx: 0, callbacks });

      expect(variables.has('key')).toBe(true);
      // After setting key and jumping to HOME, should return the image from HOME
      expect(result.type).toBe('continue');
      expect(result.line?.type).toBe('image');
    });
  });

  describe('matchInput function', () => {
    it('should match "look at desk" to examine the desk option', async () => {
      const variables = new Set<string>();
      const callbacks = {
        setVariable: (v: string) => variables.add(v),
        unsetVariable: (v: string) => variables.delete(v),
        hasVariable: (v: string) => variables.has(v),
      };

      // Step through HOME to find the wait point (decision point)
      let lineIdx = 0;
      while (true) {
        const result = step({ schema, sceneMap, sceneId: 'HOME', lineIdx, callbacks });
        if (result.type === 'wait') break;
        if (result.line) {
          const match = result.line.id.match(/^(.+)-(\d+)$/);
          if (match) lineIdx = parseInt(match[2], 10) + 1;
        }
      }

      // Use an exact alias match instead of partial "desk"
      const result = await matchInput({
        input: 'look at desk',
        schema,
        sceneMap,
        sceneId: 'HOME',
        lineIdx,
        hasVariable: callbacks.hasVariable,
        useFuzzyFallback: false, // Skip AI matching for tests
      });

      expect(result.matched).toBe(true);
      expect(result.optionText).toBe('examine the desk');
      expect(result.sceneId).toBe('DESK');
    });

    it('should match "yes" to take the key option in DESK scene', async () => {
      const variables = new Set<string>();
      const callbacks = {
        setVariable: (v: string) => variables.add(v),
        unsetVariable: (v: string) => variables.delete(v),
        hasVariable: (v: string) => variables.has(v),
      };

      // Step through DESK to find the wait point
      let lineIdx = 0;
      while (true) {
        const result = step({ schema, sceneMap, sceneId: 'DESK', lineIdx, callbacks });
        if (result.type === 'wait') break;
        if (result.line) {
          const match = result.line.id.match(/^(.+)-(\d+)$/);
          if (match) lineIdx = parseInt(match[2], 10) + 1;
        }
      }

      const result = await matchInput({
        input: 'yes',
        schema,
        sceneMap,
        sceneId: 'DESK',
        lineIdx,
        hasVariable: callbacks.hasVariable,
        useFuzzyFallback: false,
      });

      expect(result.matched).toBe(true);
      expect(result.optionText).toBe('take the key');
      expect(result.sceneId).toBe('KEY');
      expect(result.narratives?.length).toBeGreaterThan(0);
      expect(result.narratives?.[0].text).toBe('Yoink!');
    });
  });

  describe('full flow simulation', () => {
    it('should complete the desk -> yes flow without getting stuck', async () => {
      const variables = new Set<string>();
      const callbacks = {
        setVariable: (v: string) => variables.add(v),
        unsetVariable: (v: string) => variables.delete(v),
        hasVariable: (v: string) => variables.has(v),
      };

      // Helper to step until wait - simulates what handleNext does
      const stepUntilWait = (startSceneId: string, startLineIdx: number) => {
        let sceneId = startSceneId;
        let lineIdx = startLineIdx;
        const lines: string[] = [];
        let stepCount = 0;
        const maxSteps = 50;

        while (stepCount < maxSteps) {
          stepCount++;
          const result = step({ schema, sceneMap, sceneId, lineIdx, callbacks });

          if (result.type === 'wait') {
            return { sceneId, lineIdx, lines, type: 'wait' as const };
          }
          if (result.type === 'end') {
            return { sceneId, lineIdx, lines, type: 'end' as const };
          }
          if (result.type === 'error') {
            throw new Error(`Error in step: ${result.line?.text}`);
          }
          if (result.line) {
            lines.push(result.line.text);
            const match = result.line.id.match(/^(.+)-(\d+)$/);
            if (match) {
              sceneId = match[1];
              lineIdx = parseInt(match[2], 10) + 1;
            }
          }
        }
        throw new Error(`Hit max steps (${maxSteps}) - possible infinite loop`);
      };

      // 1. Start at HOME, step through to decision point
      let state = stepUntilWait('HOME', 0);
      expect(state.lines).toContain("You're in a room. You see a chair, a desk, and a plant.");

      // 2. Input "look at desk" to examine the desk (using exact alias)
      const deskResult = await matchInput({
        input: 'look at desk',
        schema,
        sceneMap,
        sceneId: state.sceneId,
        lineIdx: state.lineIdx,
        hasVariable: callbacks.hasVariable,
        useFuzzyFallback: false,
      });

      expect(deskResult.matched).toBe(true);
      expect(deskResult.sceneId).toBe('DESK');

      // 3. Step through DESK until we hit wait
      state = stepUntilWait(deskResult.sceneId!, deskResult.lineIdx ?? 0);
      expect(state.lines).toContain("Oh lookee, there's a key on it. Take it?");

      // 4. Input "yes" to take the key
      const yesResult = await matchInput({
        input: 'yes',
        schema,
        sceneMap,
        sceneId: state.sceneId,
        lineIdx: state.lineIdx,
        hasVariable: callbacks.hasVariable,
        useFuzzyFallback: false,
      });

      expect(yesResult.matched).toBe(true);
      expect(yesResult.optionText).toBe('take the key');
      expect(yesResult.sceneId).toBe('KEY');
      expect(yesResult.narratives?.[0].text).toBe('Yoink!');

      // 5. Step through KEY scene - this should set key and jump to HOME
      // This is where the bug occurs
      state = stepUntilWait(yesResult.sceneId!, yesResult.lineIdx ?? 0);

      expect(variables.has('key')).toBe(true); // Key should be set
      expect(state.sceneId).toBe('HOME'); // Should be back at HOME
      expect(state.type).toBe('wait'); // Should be waiting for input
    });
  });

  describe('nested options inside conditionals', () => {
    const NESTED_OPTIONS_SCRIPT = `
@DESK
[if: !key]
  [image: https://i.imgur.com/2Thd6hv.png]
  Oh lookee, there's a key on it. Take it?
  if take the key | yes
    Yoink!
    goto @KEY
  if don't take it | nope
    You step back.
[if: key]
  [image: https://i.imgur.com/1uOFWQr.png]
  if what about the key
     You're still holding the key.
if leave | go | exit
   goto @HOME
@KEY
[sets: key]
goto @DESK
@HOME
You're home.
`
      .trim()
      .split('\n');

    it('should find options nested inside conditionals plus top-level options', async () => {
      const schema = parseIntoSchema(NESTED_OPTIONS_SCRIPT);
      const sceneMap = constructSceneMap({ schema });
      const callbacks = {
        setVariable: () => {},
        unsetVariable: () => {},
        hasVariable: () => false, // No key
      };

      // Step through to find the decision point
      let lineIdx = 0;
      while (true) {
        const result = step({ schema, sceneMap, sceneId: 'DESK', lineIdx, callbacks });
        if (result.type === 'wait') break;
        if (result.type === 'error' || result.type === 'end') break;
        if (result.line) {
          const match = result.line.id.match(/^(.+)-(\d+)$/);
          if (match) lineIdx = parseInt(match[2], 10) + 1;
        }
      }

      // Without key: should see "take the key", "don't take it", and "leave"
      const optionsWithoutKey = await matchInput({
        input: 'take the key',
        schema,
        sceneMap,
        sceneId: 'DESK',
        lineIdx,
        hasVariable: () => false, // No key
        useFuzzyFallback: false,
      });
      expect(optionsWithoutKey.matched).toBe(true);
      expect(optionsWithoutKey.optionText).toBe('take the key');

      // "leave" should also be available (top-level option)
      const leaveWithoutKey = await matchInput({
        input: 'leave',
        schema,
        sceneMap,
        sceneId: 'DESK',
        lineIdx,
        hasVariable: () => false,
        useFuzzyFallback: false,
      });
      expect(leaveWithoutKey.matched).toBe(true);
      expect(leaveWithoutKey.sceneId).toBe('HOME');
    });

    it('should show different options when key is set', async () => {
      const schema = parseIntoSchema(NESTED_OPTIONS_SCRIPT);
      const sceneMap = constructSceneMap({ schema });
      const hasKey = (v: string) => v === 'key';
      const callbacks = {
        setVariable: () => {},
        unsetVariable: () => {},
        hasVariable: hasKey,
      };

      // Step through to find the decision point (with key set)
      let lineIdx = 0;
      while (true) {
        const result = step({ schema, sceneMap, sceneId: 'DESK', lineIdx, callbacks });
        if (result.type === 'wait') break;
        if (result.line) {
          const match = result.line.id.match(/^(.+)-(\d+)$/);
          if (match) lineIdx = parseInt(match[2], 10) + 1;
        }
      }

      // With key: should see "what about the key" and "leave"
      const optionsWithKey = await matchInput({
        input: 'what about the key',
        schema,
        sceneMap,
        sceneId: 'DESK',
        lineIdx,
        hasVariable: hasKey,
        useFuzzyFallback: false,
      });
      expect(optionsWithKey.matched).toBe(true);
      expect(optionsWithKey.optionText).toBe('what about the key');

      // "take the key" should NOT be available when key is set
      const takeKeyWithKey = await matchInput({
        input: 'take the key',
        schema,
        sceneMap,
        sceneId: 'DESK',
        lineIdx,
        hasVariable: hasKey,
        useFuzzyFallback: false,
      });
      expect(takeKeyWithKey.matched).toBe(false);

      // "leave" should still be available
      const leaveWithKey = await matchInput({
        input: 'leave',
        schema,
        sceneMap,
        sceneId: 'DESK',
        lineIdx,
        hasVariable: hasKey,
        useFuzzyFallback: false,
      });
      expect(leaveWithKey.matched).toBe(true);
    });
  });

  describe('conditional jump to END', () => {
    const CONDITIONAL_END_SCRIPT = `
@HOME
[sets: key]
[image: https://i.imgur.com/PR6oN9P.png]
You're in a room.
[if: key]
  you did it!
  goto @END
`
      .trim()
      .split('\n');

    it('should reach END when conditional with goto @END is true', () => {
      const schema = parseIntoSchema(CONDITIONAL_END_SCRIPT);
      const sceneMap = constructSceneMap({ schema });
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
      const maxSteps = 20;
      let endReached = false;

      while (stepCount < maxSteps) {
        stepCount++;
        const result = step({ schema, sceneMap, sceneId, lineIdx, callbacks });

        if (result.type === 'end') {
          endReached = true;
          break;
        }
        if (result.type === 'wait' || result.type === 'error') {
          break;
        }
        if (result.line) {
          lines.push(result.line.text);
          const match = result.line.id.match(/^(.+)-(\d+)$/);
          if (match) {
            sceneId = match[1];
            lineIdx = parseInt(match[2], 10) + 1;
          }
        }
      }

      expect(variables.has('key')).toBe(true);
      expect(lines).toContain('you did it!');
      expect(endReached).toBe(true);
    });
  });
});
