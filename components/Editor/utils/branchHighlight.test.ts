import { describe, expect, it } from 'vitest';
import { EntryType, SchemaEntry } from '@/types/schema';

// Copy the functions from branchHighlight.ts for testing
type Scene = SchemaEntry[];

function entryToComparisonKey(entry: SchemaEntry): string {
  switch (entry.type) {
    case EntryType.NARRATIVE:
      return `narrative:${entry.text}`;
    case EntryType.OPTION:
      return `option:${entry.text}`;
    case EntryType.JUMP:
      return `jump:${entry.target}`;
    case EntryType.SCENE:
      return `scene:${entry.label}`;
    case EntryType.IMAGE:
      return `image:${entry.url}`;
    default:
      return '';
  }
}

function sceneToComparisonKeys(scene: Scene): Set<string> {
  return new Set(scene.map((entry) => entryToComparisonKey(entry).toLowerCase()));
}

function lineToComparisonKey(line: string): string {
  const trimmed = line.trim();

  if (trimmed.startsWith('*')) {
    const optionPart = trimmed.slice(1).trim();
    if (optionPart.startsWith('[') && optionPart.includes(']')) {
      const inner = optionPart.slice(1, optionPart.indexOf(']'));
      const primaryText = inner.split(',')[0].trim();
      return `option:${primaryText}`;
    }
    return `option:${optionPart}`;
  }

  if (trimmed.startsWith('>')) {
    return `jump:${trimmed.slice(1).trim()}`;
  }

  const imageMatch = trimmed.match(/^\[image="(.+?)"\]$/);
  if (imageMatch) {
    return `image:${imageMatch[1]}`;
  }

  return `narrative:${trimmed}`;
}

type HighlightType = 'gray' | 'yellow' | 'green';

function getLineHighlight(
  line: string,
  baseScene: Scene | undefined,
  generatedScene: Scene | undefined,
): HighlightType {
  const baseKeys = baseScene ? sceneToComparisonKeys(baseScene) : new Set<string>();
  const generatedKeys = generatedScene ? sceneToComparisonKeys(generatedScene) : new Set<string>();

  const lineKey = lineToComparisonKey(line).toLowerCase();
  const inBase = baseKeys.has(lineKey);
  const inGenerated = generatedKeys.has(lineKey);

  if (inGenerated && !inBase) {
    return 'yellow'; // AI-added
  } else if (!inGenerated && !inBase) {
    return 'green'; // Human-edited after generation
  }
  return 'gray'; // Pre-existing in base
}

describe('branchHighlight', () => {
  describe('START scene (no explicit scene break)', () => {
    it('should highlight only newly generated option as yellow', () => {
      // Base: had image and "do nothing" option
      const baseScene: Scene = [
        { type: EntryType.IMAGE, url: 'https://example.com/image.jpg' },
        { type: EntryType.NARRATIVE, text: "you're stuck in the office" },
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait'], then: [] },
      ];

      // Generated: added new "ask why" option
      const generatedScene: Scene = [
        { type: EntryType.IMAGE, url: 'https://example.com/image.jpg' },
        { type: EntryType.NARRATIVE, text: "you're stuck in the office" },
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait'], then: [] },
        { type: EntryType.OPTION, text: 'ask why you\'re here', aliases: ['why am i here?'], then: [] },
      ];

      // Test each line
      expect(getLineHighlight('[image="https://example.com/image.jpg"]', baseScene, generatedScene))
        .toBe('gray');
      
      expect(getLineHighlight("you're stuck in the office", baseScene, generatedScene))
        .toBe('gray');
      
      // Original option with MORE aliases now - should still be gray
      expect(getLineHighlight('* [do nothing, wait, stand still, do nothing at all]', baseScene, generatedScene))
        .toBe('gray');
      
      // New option - should be yellow
      expect(getLineHighlight("* [ask why you're here, why am i here?]", baseScene, generatedScene))
        .toBe('yellow');
    });

    it('should handle option without bracket format', () => {
      const baseScene: Scene = [
        { type: EntryType.OPTION, text: 'run away', then: [] },
      ];
      const generatedScene: Scene = [
        { type: EntryType.OPTION, text: 'run away', then: [] },
        { type: EntryType.OPTION, text: 'hide', then: [] },
      ];

      expect(getLineHighlight('* run away', baseScene, generatedScene)).toBe('gray');
      expect(getLineHighlight('* hide', baseScene, generatedScene)).toBe('yellow');
    });
  });

  describe('explicit scene (with # SCENE marker)', () => {
    it('should highlight only newly generated content as yellow', () => {
      const baseScene: Scene = [
        { type: EntryType.NARRATIVE, text: 'The forest is dark.' },
        { type: EntryType.OPTION, text: 'go north', then: [] },
      ];

      const generatedScene: Scene = [
        { type: EntryType.NARRATIVE, text: 'The forest is dark.' },
        { type: EntryType.OPTION, text: 'go north', then: [] },
        { type: EntryType.OPTION, text: 'climb a tree', then: [] },
      ];

      expect(getLineHighlight('The forest is dark.', baseScene, generatedScene)).toBe('gray');
      expect(getLineHighlight('* go north', baseScene, generatedScene)).toBe('gray');
      expect(getLineHighlight('* climb a tree', baseScene, generatedScene)).toBe('yellow');
    });
  });

  describe('human edits after generation', () => {
    it('should highlight human-edited lines as green', () => {
      const baseScene: Scene = [
        { type: EntryType.NARRATIVE, text: 'Original text.' },
      ];

      const generatedScene: Scene = [
        { type: EntryType.NARRATIVE, text: 'Original text.' },
        { type: EntryType.OPTION, text: 'generated option', then: [] },
      ];

      // Line that was edited by human after generation
      expect(getLineHighlight('Completely new human text.', baseScene, generatedScene)).toBe('green');
      
      // Original stays gray
      expect(getLineHighlight('Original text.', baseScene, generatedScene)).toBe('gray');
      
      // Generated stays yellow
      expect(getLineHighlight('* generated option', baseScene, generatedScene)).toBe('yellow');
    });
  });

  describe('exact user scenario', () => {
    it('should match the user reported issue', () => {
      // User's exact scenario:
      // - Had "do nothing" option with aliases
      // - Generated "ask why you're here" option
      // - "do nothing" should be gray, "ask why" should be yellow
      
      // NOTE: In real code, scenes are FLATTENED - `then` blocks are expanded into the scene array
      // This simulates what extractScenesFromSchema + flattenEntries produces
      const baseScene: Scene = [
        { type: EntryType.IMAGE, url: 'https://i.pinimg.com/1200x/cf/e7/8f/cfe78fdd9f980d84eb8b3d8e479b5985.jpg' },
        { type: EntryType.NARRATIVE, text: "you're stuck in the office, and the door is locked." },
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait', 'stand still'], then: [] },
        { type: EntryType.NARRATIVE, text: 'time ticks away.' }, // Flattened from then block
      ];

      const generatedScene: Scene = [
        { type: EntryType.IMAGE, url: 'https://i.pinimg.com/1200x/cf/e7/8f/cfe78fdd9f980d84eb8b3d8e479b5985.jpg' },
        { type: EntryType.NARRATIVE, text: "you're stuck in the office, and the door is locked." },
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait', 'stand still', 'do nothing at all'], then: [] },
        { type: EntryType.NARRATIVE, text: 'time ticks away.' }, // Flattened from then block
        { type: EntryType.OPTION, text: 'ask why you\'re here', aliases: ['why am i here?', 'what am i doing here?', 'how did i get here?'], then: [] },
        { type: EntryType.NARRATIVE, text: "you don't remember exactly." }, // Flattened from then block
      ];

      // Image - should be gray (was in base)
      const imageLine = '[image="https://i.pinimg.com/1200x/cf/e7/8f/cfe78fdd9f980d84eb8b3d8e479b5985.jpg"]';
      expect(getLineHighlight(imageLine, baseScene, generatedScene)).toBe('gray');

      // Narrative - should be gray
      expect(getLineHighlight("you're stuck in the office, and the door is locked.", baseScene, generatedScene)).toBe('gray');

      // ORIGINAL option with MORE aliases - should be gray (was in base)
      expect(getLineHighlight('* [do nothing, wait, stand still, do nothing at all]', baseScene, generatedScene)).toBe('gray');
      
      // Its then block narrative - should be gray
      expect(getLineHighlight('time ticks away.', baseScene, generatedScene)).toBe('gray');

      // NEW option - should be yellow
      expect(getLineHighlight("* [ask why you're here, why am i here?, what am i doing here?, how did i get here?]", baseScene, generatedScene)).toBe('yellow');
      
      // Its then block narrative - should be yellow
      expect(getLineHighlight("you don't remember exactly.", baseScene, generatedScene)).toBe('yellow');
    });

    it('should debug: log comparison keys', () => {
      const baseScene: Scene = [
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait'], then: [] },
      ];

      const baseKeys = sceneToComparisonKeys(baseScene);
      console.log('Base keys:', [...baseKeys]);

      const editorLine = '* [do nothing, wait, stand still, do nothing at all]';
      const lineKey = lineToComparisonKey(editorLine).toLowerCase();
      console.log('Line key:', lineKey);
      console.log('In base:', baseKeys.has(lineKey));

      expect(baseKeys.has(lineKey)).toBe(true);
    });

    it('should handle merged branch correctly - only latest changes are yellow', () => {
      // Scenario: User's FIRST generation created "do nothing"
      // Now second generation adds "ask why"
      // With the fix, base is updated to include "do nothing" (from before this generation)
      
      // Base now reflects state BEFORE the latest generation (includes previous gen)
      const baseScene: Scene = [
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait'], then: [] },
      ];

      const generatedScene: Scene = [
        { type: EntryType.OPTION, text: 'do nothing', aliases: ['wait'], then: [] },
        { type: EntryType.OPTION, text: 'ask why you\'re here', then: [] },
      ];

      // "do nothing" is now in base, so it's gray
      expect(getLineHighlight('* [do nothing, wait]', baseScene, generatedScene)).toBe('gray');
      // Only the new option is yellow
      expect(getLineHighlight("* ask why you're here", baseScene, generatedScene)).toBe('yellow');
    });
  });

  describe('lineToComparisonKey parsing', () => {
    it('should extract primary text from bracketed options', () => {
      expect(lineToComparisonKey('* [do nothing, wait, stand]'))
        .toBe('option:do nothing');
      
      expect(lineToComparisonKey('* [ask why, why am i here?, how]'))
        .toBe('option:ask why');
    });

    it('should handle plain options', () => {
      expect(lineToComparisonKey('* run away'))
        .toBe('option:run away');
    });

    it('should handle images', () => {
      expect(lineToComparisonKey('[image="https://example.com/pic.jpg"]'))
        .toBe('image:https://example.com/pic.jpg');
    });

    it('should handle jumps', () => {
      expect(lineToComparisonKey('> FOREST'))
        .toBe('jump:FOREST');
    });

    it('should handle narratives', () => {
      expect(lineToComparisonKey('Hello world'))
        .toBe('narrative:Hello world');
    });
  });
});

