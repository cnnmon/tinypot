import { parseIntoSchema } from '@/lib/project/parser';
import { describe, expect, it } from 'vitest';
import { constructSceneMap, step } from './utils';

describe('Numeric Variables', () => {
  describe('counter behavior', () => {
    it('should increment variable on +var', () => {
      const variables = new Map<string, number>();
      const set = (v: string) => {
        const key = v.toLowerCase();
        variables.set(key, (variables.get(key) ?? 0) + 1);
      };
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      // Increment sword 3 times
      set('sword');
      set('sword');
      set('sword');

      expect(variables.get('sword')).toBe(3);
      expect(has('sword')).toBe(true);
      expect(has('sword', 3)).toBe(true);
      expect(has('sword', 4)).toBe(false);
    });

    it('should decrement variable on -var', () => {
      const variables = new Map<string, number>();
      variables.set('gold', 5);

      const unset = (v: string) => {
        const key = v.toLowerCase();
        const current = variables.get(key) ?? 0;
        if (current <= 1) {
          variables.delete(key);
        } else {
          variables.set(key, current - 1);
        }
      };

      unset('gold');
      expect(variables.get('gold')).toBe(4);

      unset('gold');
      unset('gold');
      unset('gold');
      expect(variables.get('gold')).toBe(1);

      unset('gold');
      expect(variables.has('gold')).toBe(false);
    });
  });

  describe('when var >= N syntax', () => {
    it('should trigger when threshold is met', () => {
      const script = [
        '@START',
        'You begin.',
        'when turn >= 3',
        '  Three turns have passed!',
        '  goto @END',
        'if continue',
        '  goto @START',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Turn = 2, should NOT trigger
      const variables2 = new Map<string, number>([['turn', 2]]);
      const has2 = (v: string, threshold = 1) => (variables2.get(v.toLowerCase()) ?? 0) >= threshold;

      const result2 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has2 },
      });

      expect(result2.type).toBe('continue');
      expect(result2.line?.text).toBe('You begin.');

      // Turn = 3, SHOULD trigger
      const variables3 = new Map<string, number>([['turn', 3]]);
      const has3 = (v: string, threshold = 1) => (variables3.get(v.toLowerCase()) ?? 0) >= threshold;

      // First step shows narrative, second should be conditional narrative
      const result3a = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has3 },
      });

      expect(result3a.type).toBe('continue');
      expect(result3a.line?.text).toBe('You begin.');

      // Continue stepping - should hit the conditional narrative
      const result3b = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 1,
        callbacks: { hasVariable: has3 },
      });

      expect(result3b.type).toBe('continue');
      expect(result3b.line?.text).toBe('Three turns have passed!');
    });

    it('should NOT trigger when threshold not met', () => {
      const script = [
        '@START',
        'You begin.',
        'when gold >= 10',
        '  You are rich!',
        'if wait',
        '  You wait.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Gold = 5, should not trigger rich message
      const variables = new Map<string, number>([['gold', 5]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      // First narrative
      const result1 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      expect(result1.type).toBe('continue');
      expect(result1.line?.text).toBe('You begin.');

      // Should wait for input, NOT show "You are rich!"
      const result2 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 1,
        callbacks: { hasVariable: has },
      });

      expect(result2.type).toBe('wait');
    });
  });

  describe('global when blocks (preamble)', () => {
    it('should check preamble conditions and jump when met', () => {
      const script = [
        'when turn >= 5',
        '  goto @GAME_OVER',
        '@START',
        'You are playing.',
        '@GAME_OVER',
        'Time is up!',
        'goto @END',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Turn = 5, should trigger preamble jump
      const variables = new Map<string, number>([['turn', 5]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      const result = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      // Should have jumped to GAME_OVER
      expect(result.type).toBe('continue');
      expect(result.line?.text).toBe('Time is up!');
    });

    it('should NOT jump if preamble condition not met', () => {
      const script = [
        'when turn >= 10',
        '  goto @GAME_OVER',
        '@START',
        'You are playing.',
        '@GAME_OVER',
        'Time is up!',
        'goto @END',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Turn = 3, should NOT trigger
      const variables = new Map<string, number>([['turn', 3]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      const result = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      // Should show START scene
      expect(result.type).toBe('continue');
      expect(result.line?.text).toBe('You are playing.');
    });

    it('should trigger @END from preamble', () => {
      const script = [
        'when exhausted',
        '  goto @END',
        '@START',
        'You walk.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      const variables = new Map<string, number>([['exhausted', 1]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      const result = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      expect(result.type).toBe('end');
    });

    it('should prepend preamble narratives to first scene line', () => {
      const script = [
        'when turn >= 3',
        '  You feel older.',
        '@START',
        'What do you want to do?',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      const variables = new Map<string, number>([['turn', 5]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      const result = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      expect(result.type).toBe('continue');
      expect(result.line?.text).toContain('You feel older.');
      expect(result.line?.text).toContain('What do you want to do?');
    });

    it('should NOT show preamble narrative when lineIdx > 0', () => {
      const script = [
        'when turn >= 3',
        '  You feel older.',
        '@START',
        'Line one.',
        'Line two.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      const variables = new Map<string, number>([['turn', 5]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      // Check lineIdx 1 - should NOT include preamble
      const result = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 1,
        callbacks: { hasVariable: has },
      });

      expect(result.type).toBe('continue');
      expect(result.line?.text).toBe('Line two.');
      expect(result.line?.text).not.toContain('You feel older.');
    });

    it('should handle top-level goto in preamble as entry point', () => {
      const script = [
        'when turn >= 3',
        '  You are old.',
        '  goto @END',
        'when turn >= 2',
        '  You are older.',
        'when turn >= 1',
        '  You are young.',
        'goto @BEGIN',
        '@BEGIN',
        'What do you want to do?',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Turn = 1
      const variables = new Map<string, number>([['turn', 1]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      // Starting from 'START' (default) should follow the goto @BEGIN
      const result = step({
        schema,
        sceneMap,
        sceneId: 'START', // Default scene
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      // Should show preamble narrative + scene content
      expect(result.type).toBe('continue');
      expect(result.line?.text).toContain('You are young.');
      expect(result.line?.text).toContain('What do you want to do?');
    });

    it('should handle life sim script with choices that loop', () => {
      const script = [
        'when turn >= 3',
        '  You are old.',
        '  goto @END',
        'when turn >= 2',
        '  You are older.',
        'when turn >= 1',
        '  You are young.',
        'goto @BEGIN',
        '@BEGIN',
        'What do you want to do?',
        'if run around',
        '  You dash around energetically.',
        'if accept and refocus',
        '  Right. Time to get serious.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Turn = 2
      const variables = new Map<string, number>([['turn', 2]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      // First step - should show preamble + scene content
      const result1 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      expect(result1.type).toBe('continue');
      expect(result1.line?.text).toContain('You are older.');
      expect(result1.line?.text).toContain('What do you want to do?');

      // Next step - should wait for input (options available)
      const result2 = step({
        schema,
        sceneMap,
        sceneId: 'BEGIN',
        lineIdx: 1,
        callbacks: { hasVariable: has },
      });

      expect(result2.type).toBe('wait');
    });

    it('should NOT infinitely loop with top-level goto when already in target scene', () => {
      const script = [
        'when turn >= 1',
        '  You are young.',
        'goto @BEGIN',
        '@BEGIN',
        'What do you want to do?',
        'if run around',
        '  You dash around.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      const variables = new Map<string, number>([['turn', 1]]);
      const has = (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold;

      // When already in BEGIN, should NOT re-process the goto
      const result = step({
        schema,
        sceneMap,
        sceneId: 'BEGIN', // Already in BEGIN
        lineIdx: 0,
        callbacks: { hasVariable: has },
      });

      // Should show preamble narrative + scene content (not loop)
      expect(result.type).toBe('continue');
      expect(result.line?.text).toContain('You are young.');
      expect(result.line?.text).toContain('What do you want to do?');
    });
  });

  describe('display formatting', () => {
    it('should format variables correctly for display', () => {
      const format = (entries: [string, number][]) =>
        entries.map(([key, count]) => (count > 1 ? `${key} (${count})` : key));

      expect(format([['sword', 1]])).toEqual(['sword']);
      expect(format([['sword', 2]])).toEqual(['sword (2)']);
      expect(format([['gold', 5], ['sword', 1]])).toEqual(['gold (5)', 'sword']);
    });
  });

  describe('compound conditions (AND with &)', () => {
    it('should match turn >= 1 & turn < 2 only when turn is exactly 1', () => {
      const script = [
        'when turn >= 3',
        "  You're old.",
        '  goto @END',
        'when turn >= 2 & turn < 3',
        "  You're older.",
        'when turn >= 1 & turn < 2',
        "  You're young.",
        'goto @YOUTH',
        '@YOUTH',
        'You are born.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Helper to create variable callbacks
      const makeCallbacks = (turnValue: number) => {
        const variables = new Map<string, number>([['turn', turnValue]]);
        return {
          hasVariable: (v: string, threshold = 1) => (variables.get(v.toLowerCase()) ?? 0) >= threshold,
          getVariable: (v: string) => variables.get(v.toLowerCase()) ?? 0,
        };
      };

      // Turn = 1: should show "You're young." + "You are born."
      const result1 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: makeCallbacks(1),
      });

      expect(result1.type).toBe('continue');
      expect(result1.line?.text).toContain("You're young.");
      expect(result1.line?.text).toContain('You are born.');
      expect(result1.line?.text).not.toContain("You're older.");
      expect(result1.line?.text).not.toContain("You're old.");

      // Turn = 2: should show "You're older." + "You are born."
      const result2 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: makeCallbacks(2),
      });

      expect(result2.type).toBe('continue');
      expect(result2.line?.text).toContain("You're older.");
      expect(result2.line?.text).toContain('You are born.');
      expect(result2.line?.text).not.toContain("You're young.");
      expect(result2.line?.text).not.toContain("You're old.");

      // Turn = 3: should show "You're old." and end
      const result3 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: makeCallbacks(3),
      });

      expect(result3.type).toBe('end');
    });

    it('should work when turn is incremented just before checking (simulating React async state)', () => {
      // This test simulates what happens in the real player:
      // 1. User submits input
      // 2. variables.set('turn') is called - but React state hasn't updated yet
      // 3. processGlobalPreamble checks conditions with the OLD state
      //
      // We simulate this by having the "state" at turn=0, but needing to check as if turn=1
      const script = [
        'when turn >= 3',
        "  You're old.",
        '  goto @END',
        'when turn >= 2 & turn < 3',
        "  You're older.",
        'when turn >= 1 & turn < 2',
        "  You're young.",
        'goto @YOUTH',
        '@YOUTH',
        'You are born.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // Simulate: turn starts at 0, but we just called set('turn') which should make it 1
      // The pendingIncrement represents the +1 that will be applied
      const baseValue = 0;
      const pendingIncrement = 1;
      const effectiveTurn = baseValue + pendingIncrement;

      const variables = new Map<string, number>([['turn', baseValue]]);
      
      // These callbacks should account for the pending increment on 'turn'
      const hasWithPending = (v: string, threshold = 1) => {
        const value = variables.get(v.toLowerCase()) ?? 0;
        const effective = v.toLowerCase() === 'turn' ? value + pendingIncrement : value;
        return effective >= threshold;
      };
      const getWithPending = (v: string) => {
        const value = variables.get(v.toLowerCase()) ?? 0;
        return v.toLowerCase() === 'turn' ? value + pendingIncrement : value;
      };

      const result = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: {
          hasVariable: hasWithPending,
          getVariable: getWithPending,
        },
      });

      // Should show "You're young." because effective turn = 1
      expect(result.type).toBe('continue');
      expect(result.line?.text).toContain("You're young.");
      expect(result.line?.text).toContain('You are born.');
    });

    it('should handle compound less-than conditions', () => {
      const script = [
        'when gold >= 5 & gold < 10',
        '  You have some gold.',
        '@START',
        'Welcome.',
      ];

      const schema = parseIntoSchema(script);
      const sceneMap = constructSceneMap({ schema });

      // gold = 7 (5 <= 7 < 10) -> should trigger
      const variables7 = new Map<string, number>([['gold', 7]]);
      const result7 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: {
          hasVariable: (v: string, threshold = 1) => (variables7.get(v.toLowerCase()) ?? 0) >= threshold,
          getVariable: (v: string) => variables7.get(v.toLowerCase()) ?? 0,
        },
      });

      expect(result7.type).toBe('continue');
      expect(result7.line?.text).toContain('You have some gold.');

      // gold = 3 (< 5) -> should NOT trigger
      const variables3 = new Map<string, number>([['gold', 3]]);
      const result3 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: {
          hasVariable: (v: string, threshold = 1) => (variables3.get(v.toLowerCase()) ?? 0) >= threshold,
          getVariable: (v: string) => variables3.get(v.toLowerCase()) ?? 0,
        },
      });

      expect(result3.type).toBe('continue');
      expect(result3.line?.text).toBe('Welcome.');
      expect(result3.line?.text).not.toContain('You have some gold.');

      // gold = 10 (>= 10) -> should NOT trigger
      const variables10 = new Map<string, number>([['gold', 10]]);
      const result10 = step({
        schema,
        sceneMap,
        sceneId: 'START',
        lineIdx: 0,
        callbacks: {
          hasVariable: (v: string, threshold = 1) => (variables10.get(v.toLowerCase()) ?? 0) >= threshold,
          getVariable: (v: string) => variables10.get(v.toLowerCase()) ?? 0,
        },
      });

      expect(result10.type).toBe('continue');
      expect(result10.line?.text).toBe('Welcome.');
      expect(result10.line?.text).not.toContain('You have some gold.');
    });
  });
});
