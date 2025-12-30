import { describe, expect, it } from 'vitest';
import { EntryType, Schema } from '@/types/schema';
import { createBranch, extractScenesFromSchema, scenesEqual } from './index';

describe('Branch diffing', () => {
  // Helper to create a narrative entry
  const narrative = (text: string) => ({ type: EntryType.NARRATIVE as const, text });
  const option = (text: string, then: Schema = []) => ({
    type: EntryType.OPTION as const,
    text,
    then,
  });
  const jump = (target: string) => ({ type: EntryType.JUMP as const, target });
  const scene = (label: string) => ({ type: EntryType.SCENE as const, label });

  describe('extractScenesFromSchema', () => {
    it('extracts scenes from schema with flattened entries', () => {
      const schema: Schema = [
        scene('HOME'),
        narrative('The fire burns brightly.'),
        option('Ride a bike', [narrative("That's cool!"), jump('BIKE')]),
        scene('BIKE'),
        narrative('Learn to sail'),
        jump('END'),
      ];

      const scenes = extractScenesFromSchema(schema);

      expect(scenes.size).toBe(2);
      expect(scenes.has('HOME')).toBe(true);
      expect(scenes.has('BIKE')).toBe(true);

      // HOME scene is flattened: narrative + option + option's then contents
      const homeScene = scenes.get('HOME')!;
      expect(homeScene.length).toBe(4); // narrative + option + "That's cool!" + "> BIKE"
    });
  });

  describe('scenesEqual', () => {
    it('returns true for identical scenes', () => {
      const sceneA = [narrative('Hello'), option('Test')];
      const sceneB = [narrative('Hello'), option('Test')];
      expect(scenesEqual(sceneA, sceneB)).toBe(true);
    });

    it('returns false for different scenes', () => {
      const sceneA = [narrative('Hello')];
      const sceneB = [narrative('World')];
      expect(scenesEqual(sceneA, sceneB)).toBe(false);
    });

    it('returns false for different lengths', () => {
      const sceneA = [narrative('Hello')];
      const sceneB = [narrative('Hello'), narrative('World')];
      expect(scenesEqual(sceneA, sceneB)).toBe(false);
    });
  });

  describe('createBranch', () => {
    it('detects added option in scene', () => {
      // Base schema: HOME with two options
      const baseSchema: Schema = [
        scene('HOME'),
        narrative('The fire burns brightly.'),
        option('Ride a bike', [narrative("That's cool!"), jump('BIKE')]),
        option('Run away', [narrative('Weirdo…')]),
        scene('BIKE'),
        narrative('Learn to sail'),
        jump('END'),
      ];

      // Generated schema: HOME with new option added
      const generatedSchema: Schema = [
        scene('HOME'),
        narrative('The fire burns brightly.'),
        option('Ride a bike', [narrative("That's cool!"), jump('BIKE')]),
        option('Run away', [narrative('Weirdo…')]),
        option('Look Around', [
          narrative('Your wandering gaze sweeps across the flickering firelight.'),
          narrative('Mystery hangs in the air like woodsmoke.'),
          narrative('So many possibilities... but which one calls to you?'),
        ]),
        scene('BIKE'),
        narrative('Learn to sail'),
        jump('END'),
      ];

      const branch = createBranch('playthrough-1', baseSchema, generatedSchema);

      // Should only affect HOME scene
      expect(branch.sceneIds).toEqual(['HOME']);

      // Base should have the original HOME scene (flattened)
      // narrative + option + "That's cool!" + "> BIKE" + option + "Weirdo…" = 6
      const baseHome = branch.base.get('HOME')!;
      expect(baseHome.length).toBe(6);

      // Generated should have the new HOME scene (flattened)
      // Base entries (6) + new option + 3 narratives = 10
      const genHome = branch.generated.get('HOME')!;
      expect(genHome.length).toBe(10);

      // The new option should be in generated but not in base
      const baseHasLookAround = baseHome.some(
        (e) => e.type === EntryType.OPTION && e.text === 'Look Around',
      );
      const genHasLookAround = genHome.some(
        (e) => e.type === EntryType.OPTION && e.text === 'Look Around',
      );

      expect(baseHasLookAround).toBe(false);
      expect(genHasLookAround).toBe(true);
    });

    it('does not include unchanged scenes', () => {
      const baseSchema: Schema = [
        scene('HOME'),
        narrative('Hello'),
        scene('BIKE'),
        narrative('World'),
      ];

      // Only HOME changes
      const generatedSchema: Schema = [
        scene('HOME'),
        narrative('Hello'),
        narrative('New line!'),
        scene('BIKE'),
        narrative('World'),
      ];

      const branch = createBranch('playthrough-1', baseSchema, generatedSchema);

      // Only HOME should be affected
      expect(branch.sceneIds).toEqual(['HOME']);
      expect(branch.base.has('BIKE')).toBe(false);
      expect(branch.generated.has('BIKE')).toBe(false);
    });

    it('handles new scenes', () => {
      const baseSchema: Schema = [scene('HOME'), narrative('Hello')];

      const generatedSchema: Schema = [
        scene('HOME'),
        narrative('Hello'),
        scene('NEW_SCENE'),
        narrative('Brand new!'),
      ];

      const branch = createBranch('playthrough-1', baseSchema, generatedSchema);

      expect(branch.sceneIds).toContain('NEW_SCENE');
      expect(branch.base.get('NEW_SCENE')).toEqual([]); // didn't exist
      expect(branch.generated.get('NEW_SCENE')!.length).toBe(1);
    });
  });
});

describe('Line-level diff detection', () => {
  const narrative = (text: string) => ({ type: EntryType.NARRATIVE as const, text });
  const option = (text: string, then: Schema = []) => ({
    type: EntryType.OPTION as const,
    text,
    then,
  });
  const jump = (target: string) => ({ type: EntryType.JUMP as const, target });
  const scene = (label: string) => ({ type: EntryType.SCENE as const, label });

  it('identifies which lines are AI-generated vs pre-existing', () => {
    // This test documents the expected behavior for highlighting:
    // - Lines in base: pre-existing (gray)
    // - Lines in generated but not base: AI-added (yellow)
    // - Lines in current but not generated: human-edited (green)

    const baseSchema: Schema = [
      scene('HOME'),
      narrative('The fire burns brightly.'),
      option('Ride a bike', [narrative("That's cool!")]),
    ];

    const generatedSchema: Schema = [
      scene('HOME'),
      narrative('The fire burns brightly.'),
      option('Ride a bike', [narrative("That's cool!")]),
      option('Look Around', [narrative('Mystery awaits.')]),
    ];

    const branch = createBranch('test', baseSchema, generatedSchema);

    const baseHome = branch.base.get('HOME')!;
    const genHome = branch.generated.get('HOME')!;

    // Pre-existing entries should be in both
    const fireInBase = baseHome.some(
      (e) => e.type === EntryType.NARRATIVE && e.text === 'The fire burns brightly.',
    );
    const fireInGen = genHome.some(
      (e) => e.type === EntryType.NARRATIVE && e.text === 'The fire burns brightly.',
    );
    expect(fireInBase).toBe(true);
    expect(fireInGen).toBe(true);

    // AI-added entry should only be in generated
    const lookAroundInBase = baseHome.some(
      (e) => e.type === EntryType.OPTION && e.text === 'Look Around',
    );
    const lookAroundInGen = genHome.some(
      (e) => e.type === EntryType.OPTION && e.text === 'Look Around',
    );
    expect(lookAroundInBase).toBe(false);
    expect(lookAroundInGen).toBe(true);
  });

  it('correctly classifies lines for highlighting', () => {
    // Simulates the user's example:
    // Base has: "Ride a bike" with "That's cool!" and "> BIKE", plus "Run away"
    // Generated adds: "Look Around" option with new narratives
    // Expected: "That's cool!" and "> BIKE" should be GRAY (pre-existing)
    //           "Look Around" and its narratives should be YELLOW (AI-added)

    const baseSchema: Schema = [
      scene('HOME'),
      narrative('The fire burns brightly.'),
      option('Ride a bike', [narrative("That's cool!"), jump('BIKE')]),
      option('Run away', [narrative('Weirdo…')]),
      scene('BIKE'),
      narrative('Learn to sail'),
      jump('END'),
    ];

    const generatedSchema: Schema = [
      scene('HOME'),
      narrative('The fire burns brightly.'),
      option('Ride a bike', [narrative("That's cool!"), jump('BIKE')]),
      option('Run away', [narrative('Weirdo…')]),
      option('Look Around', [
        narrative('Your wandering gaze sweeps across the flickering firelight.'),
        narrative('Mystery hangs in the air like woodsmoke.'),
        narrative('So many possibilities... but which one calls to you?'),
      ]),
      scene('BIKE'),
      narrative('Learn to sail'),
      jump('END'),
    ];

    const branch = createBranch('test', baseSchema, generatedSchema);

    const baseHome = branch.base.get('HOME')!;
    const genHome = branch.generated.get('HOME')!;

    // Helper to convert entry to normalized text (like the highlighter does)
    const toText = (e: { type: string; text?: string; target?: string }) => {
      if (e.type === 'narrative') return e.text?.toLowerCase() ?? '';
      if (e.type === 'option') return `~ ${e.text}`.toLowerCase();
      if (e.type === 'goto') return `> ${e.target}`.toLowerCase();
      return '';
    };

    const baseLines = baseHome.map((e) => toText(e as any));
    const genLines = genHome.map((e) => toText(e as any));

    // Test classification logic (same as highlighter uses)
    const classifyLine = (line: string) => {
      const normalized = line.toLowerCase().trim();
      const inBase = baseLines.includes(normalized);
      const inGenerated = genLines.includes(normalized);

      if (inGenerated && !inBase) return 'yellow'; // AI-added
      if (!inGenerated && !inBase) return 'green'; // Human-edited
      return 'gray'; // Pre-existing
    };

    // Pre-existing lines should be gray
    expect(classifyLine('The fire burns brightly.')).toBe('gray');
    expect(classifyLine('~ Ride a bike')).toBe('gray');
    expect(classifyLine('~ Run away')).toBe('gray');

    // AI-added lines should be yellow
    expect(classifyLine('~ Look Around')).toBe('yellow');
    expect(classifyLine('Your wandering gaze sweeps across the flickering firelight.')).toBe(
      'yellow',
    );
    expect(classifyLine('Mystery hangs in the air like woodsmoke.')).toBe('yellow');

    // Lines not in either (hypothetical human edit) would be green
    expect(classifyLine('Something completely new')).toBe('green');
  });
});

