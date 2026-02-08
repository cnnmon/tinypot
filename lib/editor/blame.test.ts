import { describe, expect, it } from 'vitest';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { computeBlame } from './blame';

describe('computeBlame', () => {
  // Helper to create a version
  const makeVersion = (
    id: string,
    creator: Entity.AUTHOR | Entity.SYSTEM,
    script: string[],
    createdAt: number = Date.now(),
    resolved?: boolean,
  ): Version => ({
    id: id as any,
    creator,
    createdAt,
    resolved,
    snapshot: { script, guidebook: '' },
  });

  describe('basic attribution', () => {
    it('should attribute all lines to null when no versions exist', () => {
      const script = ['line 1', 'line 2', 'line 3'];
      const blame = computeBlame(script, []);
      expect(blame).toEqual([null, null, null]);
    });

    it('should attribute lines added by AI to SYSTEM', () => {
      const currentScript = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
      
      // AI added "if look around" and its response
      const aiVersion = makeVersion('v2', Entity.SYSTEM, currentScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);
      
      const blame = computeBlame(currentScript, [aiVersion, authorVersion]);
      
      // "if look around" and "You see things." were added by AI
      expect(blame[2]).toBe(Entity.SYSTEM); // "if look around"
      expect(blame[3]).toBe(Entity.SYSTEM); // "  You see things."
      
      // Original lines should not be attributed to AI
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "The fire burns."
    });

    it('should attribute lines added by author to AUTHOR', () => {
      const currentScript = ['@HOME', 'The fire burns.', 'A new line by author.'];
      
      const authorV2 = makeVersion('v2', Entity.AUTHOR, currentScript, 2000);
      const authorV1 = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);
      
      const blame = computeBlame(currentScript, [authorV2, authorV1]);
      
      expect(blame[2]).toBe(Entity.AUTHOR); // New line added by author
    });
  });

  describe('insertion without false positives', () => {
    it('should NOT blame duplicate lines that already existed', () => {
      // Original has "What do you want to do?" appearing twice
      const originalScript = [
        '@HOME',
        'What do you want to do?',
        'if go outside',
        '  You step outside.',
        '  What do you want to do?',
      ];

      // AI adds "if look around" with another "What do you want to do?"
      const afterAiScript = [
        '@HOME',
        'What do you want to do?',
        'if go outside',
        '  You step outside.',
        '  What do you want to do?',
        'if look around',
        '  You glance around.',
        '  What do you want to do?',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // Only AI-added lines should be blamed
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "What do you want to do?" - original
      expect(blame[2]).not.toBe(Entity.SYSTEM); // "if go outside" - original
      expect(blame[3]).not.toBe(Entity.SYSTEM); // "You step outside." - original
      expect(blame[4]).not.toBe(Entity.SYSTEM); // "What do you want to do?" - original
      expect(blame[5]).toBe(Entity.SYSTEM); // "if look around" - AI added
      expect(blame[6]).toBe(Entity.SYSTEM); // "You glance around." - AI added
      expect(blame[7]).toBe(Entity.SYSTEM); // "What do you want to do?" - AI added
    });

    it('should NOT attribute shifted lines to AI when AI inserts in the middle', () => {
      // Original script by author
      const originalScript = [
        '@HOME',
        'The fire burns.',
        '@BIKE',
        'You ride into the sunset.',
        'goto @END',
      ];

      // AI adds "if look around" + response between HOME content and BIKE
      const afterAiScript = [
        '@HOME',
        'The fire burns.',
        'if look around',
        '  You see dancing shadows.',
        '@BIKE',
        'You ride into the sunset.',
        'goto @END',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI lines should be attributed to SYSTEM
      expect(blame[2]).toBe(Entity.SYSTEM); // "if look around"
      expect(blame[3]).toBe(Entity.SYSTEM); // "  You see dancing shadows."

      // Original lines that just shifted should NOT be attributed to AI
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME" - original
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "The fire burns." - original
      expect(blame[4]).not.toBe(Entity.SYSTEM); // "@BIKE" - shifted but original
      expect(blame[5]).not.toBe(Entity.SYSTEM); // "You ride into the sunset." - shifted but original
      expect(blame[6]).not.toBe(Entity.SYSTEM); // "goto @END" - shifted but original
    });

    it('should handle AI adding a new scene without blaming existing scenes', () => {
      const originalScript = [
        '@HOME',
        'You are home.',
      ];

      const afterAiScript = [
        '@HOME',
        'You are home.',
        'if explore',
        '  goto @GARDEN',
        '@GARDEN',
        'Flowers bloom around you.',
        'goto @END',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI-added lines
      expect(blame[2]).toBe(Entity.SYSTEM); // "if explore"
      expect(blame[3]).toBe(Entity.SYSTEM); // "  goto @GARDEN"
      expect(blame[4]).toBe(Entity.SYSTEM); // "@GARDEN"
      expect(blame[5]).toBe(Entity.SYSTEM); // "Flowers bloom around you."
      expect(blame[6]).toBe(Entity.SYSTEM); // "goto @END"

      // Original lines
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "You are home."
    });
  });

  describe('author editing AI content', () => {
    it('should attribute author-modified AI lines to AUTHOR', () => {
      // AI added some content
      const aiScript = [
        '@HOME',
        'The fire burns.',
        'if look around',
        '  You see things.',
      ];

      // Author edited the AI response
      const authorEditedScript = [
        '@HOME',
        'The fire burns.',
        'if look around',
        '  You see dancing shadows and feel the warmth.',
      ];

      const authorV3 = makeVersion('v3', Entity.AUTHOR, authorEditedScript, 3000);
      const aiV2 = makeVersion('v2', Entity.SYSTEM, aiScript, 2000);
      const authorV1 = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);

      const blame = computeBlame(authorEditedScript, [authorV3, aiV2, authorV1]);

      // "if look around" is still from AI (unchanged)
      expect(blame[2]).toBe(Entity.SYSTEM);
      
      // The edited response should now be attributed to AUTHOR
      expect(blame[3]).toBe(Entity.AUTHOR);
    });
  });

  describe('edge cases', () => {
    it('should handle empty scripts', () => {
      const blame = computeBlame([], []);
      expect(blame).toEqual([]);
    });

    it('should handle single version', () => {
      const script = ['@HOME', 'Hello'];
      const version = makeVersion('v1', Entity.AUTHOR, script, 1000);
      
      const blame = computeBlame(script, [version]);
      
      // With single version, lines added in that version are attributed to its creator
      expect(blame[0]).toBe(Entity.AUTHOR);
      expect(blame[1]).toBe(Entity.AUTHOR);
    });

    it('should ignore whitespace differences in line matching', () => {
      const currentScript = ['  @HOME  ', 'The fire burns.'];
      const version = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);
      
      const blame = computeBlame(currentScript, [version]);
      
      // Should still match despite whitespace differences
      expect(blame[0]).not.toBe(Entity.SYSTEM);
    });
  });

  describe('AI generation scenarios', () => {
    it('should not highlight next scene when AI adds inline text before it', () => {
      // Author has two scenes
      const originalScript = [
        '@HOME',
        'You are in a cozy room.',
        '@GARDEN',
        'Flowers bloom everywhere.',
      ];

      // AI adds inline text in HOME scene (not a new scene)
      const afterAiScript = [
        '@HOME',
        'You are in a cozy room.',
        'A gentle breeze comes through the window.',
        '@GARDEN',
        'Flowers bloom everywhere.',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // Only the AI-added line should be highlighted
      expect(blame[2]).toBe(Entity.SYSTEM); // AI added inline text
      
      // Next scene should NOT be highlighted
      expect(blame[3]).not.toBe(Entity.SYSTEM); // @GARDEN - original
      expect(blame[4]).not.toBe(Entity.SYSTEM); // Flowers bloom - original
      
      // Original HOME content should not be highlighted
      expect(blame[0]).not.toBe(Entity.SYSTEM); // @HOME
      expect(blame[1]).not.toBe(Entity.SYSTEM); // You are in a cozy room
    });

    it('should not highlight existing scene when AI adds new scene after it', () => {
      // Author has one scene
      const originalScript = [
        '@HOME',
        'You are in a cozy room.',
        '@END',
      ];

      // AI adds a new scene between HOME and END
      const afterAiScript = [
        '@HOME',
        'You are in a cozy room.',
        'if go outside',
        '  goto @GARDEN',
        '@GARDEN',
        'Flowers bloom everywhere.',
        'goto @END',
        '@END',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI-added lines should be highlighted
      expect(blame[2]).toBe(Entity.SYSTEM); // if go outside
      expect(blame[3]).toBe(Entity.SYSTEM); // goto @GARDEN
      expect(blame[4]).toBe(Entity.SYSTEM); // @GARDEN
      expect(blame[5]).toBe(Entity.SYSTEM); // Flowers bloom
      expect(blame[6]).toBe(Entity.SYSTEM); // goto @END
      
      // Original lines should NOT be highlighted
      expect(blame[0]).not.toBe(Entity.SYSTEM); // @HOME
      expect(blame[1]).not.toBe(Entity.SYSTEM); // You are in a cozy room
      expect(blame[7]).not.toBe(Entity.SYSTEM); // @END - original
    });

    it('should handle AI adding multiple inline responses without new scenes', () => {
      const originalScript = [
        '@HOME',
        'The fire crackles.',
        '@KITCHEN',
        'Pots and pans hang on the wall.',
      ];

      // AI adds two inline responses in HOME (no scene changes)
      const afterAiScript = [
        '@HOME',
        'The fire crackles.',
        'if look around',
        '  You notice shadows dancing on the walls.',
        'if sit down',
        '  You rest by the warm fire.',
        '@KITCHEN',
        'Pots and pans hang on the wall.',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI-added lines
      expect(blame[2]).toBe(Entity.SYSTEM); // if look around
      expect(blame[3]).toBe(Entity.SYSTEM); // You notice shadows
      expect(blame[4]).toBe(Entity.SYSTEM); // if sit down
      expect(blame[5]).toBe(Entity.SYSTEM); // You rest by the warm fire
      
      // Original lines - should NOT be highlighted
      expect(blame[0]).not.toBe(Entity.SYSTEM); // @HOME
      expect(blame[1]).not.toBe(Entity.SYSTEM); // The fire crackles
      expect(blame[6]).not.toBe(Entity.SYSTEM); // @KITCHEN
      expect(blame[7]).not.toBe(Entity.SYSTEM); // Pots and pans
    });
  });

  describe('AI generation edge cases', () => {
    it('should correctly handle AI adding "if" option with indented response before next scene', () => {
      // Real-world scenario: Author has two scenes, AI adds a choice in the first scene
      const originalScript = [
        '@HOME',
        'The fire crackles softly.',
        '@GARDEN',
        'Flowers sway in the breeze.',
      ];

      // AI adds an "if" option with an indented response
      const afterAiScript = [
        '@HOME',
        'The fire crackles softly.',
        'if look around',
        '   You notice shadows dancing on the walls.',
        '@GARDEN',
        'Flowers sway in the breeze.',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI-added lines should be highlighted
      expect(blame[2]).toBe(Entity.SYSTEM); // "if look around"
      expect(blame[3]).toBe(Entity.SYSTEM); // "   You notice shadows..."

      // Original lines should NOT be highlighted
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "The fire crackles softly."
      expect(blame[4]).not.toBe(Entity.SYSTEM); // "@GARDEN" - CRITICAL: should NOT be highlighted
      expect(blame[5]).not.toBe(Entity.SYSTEM); // "Flowers sway in the breeze."
    });

    it('should handle AI adding TEXT_ONLY response (no goto, stays in scene)', () => {
      // TEXT_ONLY response: just narrative, no scene jump
      const originalScript = [
        '@CAVE',
        'Darkness surrounds you.',
        '@EXIT',
        'You see daylight ahead.',
      ];

      const afterAiScript = [
        '@CAVE',
        'Darkness surrounds you.',
        'if examine walls',
        '   The walls are covered in ancient runes.',
        '@EXIT',
        'You see daylight ahead.',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      expect(blame[2]).toBe(Entity.SYSTEM); // AI added
      expect(blame[3]).toBe(Entity.SYSTEM); // AI added
      expect(blame[4]).not.toBe(Entity.SYSTEM); // @EXIT - original
      expect(blame[5]).not.toBe(Entity.SYSTEM); // "You see daylight..." - original
    });

    it('should handle AI adding LINK_SCENE response (goto existing scene)', () => {
      const originalScript = [
        '@TOWN',
        'The town square is busy.',
        '@SHOP',
        'Goods line the shelves.',
      ];

      const afterAiScript = [
        '@TOWN',
        'The town square is busy.',
        'if enter shop | go to shop | visit shop',
        '   You walk into the shop.',
        '   goto @SHOP',
        '@SHOP',
        'Goods line the shelves.',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI-added lines
      expect(blame[2]).toBe(Entity.SYSTEM); // "if enter shop..."
      expect(blame[3]).toBe(Entity.SYSTEM); // "   You walk into the shop."
      expect(blame[4]).toBe(Entity.SYSTEM); // "   goto @SHOP"

      // Original lines should NOT be highlighted
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@TOWN"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "The town square is busy."
      expect(blame[5]).not.toBe(Entity.SYSTEM); // "@SHOP" - original, must not be highlighted
      expect(blame[6]).not.toBe(Entity.SYSTEM); // "Goods line the shelves." - original
    });

    it('should handle AI adding NEW_FORK response (new scene at end)', () => {
      const originalScript = [
        '@HOME',
        'You are at home.',
        '@END',
      ];

      // AI adds choice + new scene at the end
      const afterAiScript = [
        '@HOME',
        'You are at home.',
        'if go outside',
        '   You step into the sunlight.',
        '   goto @GARDEN',
        '@GARDEN',
        'A beautiful garden stretches before you.',
        'goto @END',
        '@END',
      ];

      const aiVersion = makeVersion('v2', Entity.SYSTEM, afterAiScript, 2000);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, originalScript, 1000);

      const blame = computeBlame(afterAiScript, [aiVersion, authorVersion]);

      // AI-added lines
      expect(blame[2]).toBe(Entity.SYSTEM); // "if go outside"
      expect(blame[3]).toBe(Entity.SYSTEM); // "   You step into the sunlight."
      expect(blame[4]).toBe(Entity.SYSTEM); // "   goto @GARDEN"
      expect(blame[5]).toBe(Entity.SYSTEM); // "@GARDEN"
      expect(blame[6]).toBe(Entity.SYSTEM); // "A beautiful garden..."
      expect(blame[7]).toBe(Entity.SYSTEM); // "goto @END"

      // Original lines
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "You are at home."
      expect(blame[8]).not.toBe(Entity.SYSTEM); // "@END" - original
    });

    it('should handle multiple AI generations in sequence', () => {
      // First author creates basic script
      const v1Script = [
        '@HOME',
        'The room is warm.',
        '@END',
      ];

      // AI adds first option
      const v2Script = [
        '@HOME',
        'The room is warm.',
        'if look around',
        '   You see a cozy fireplace.',
        '@END',
      ];

      // AI adds second option
      const v3Script = [
        '@HOME',
        'The room is warm.',
        'if look around',
        '   You see a cozy fireplace.',
        'if sit down',
        '   You rest on the soft couch.',
        '@END',
      ];

      const aiV3 = makeVersion('v3', Entity.SYSTEM, v3Script, 3000);
      const aiV2 = makeVersion('v2', Entity.SYSTEM, v2Script, 2000);
      const authorV1 = makeVersion('v1', Entity.AUTHOR, v1Script, 1000);

      const blame = computeBlame(v3Script, [aiV3, aiV2, authorV1]);

      // All AI-added lines should be SYSTEM
      expect(blame[2]).toBe(Entity.SYSTEM); // "if look around" from v2
      expect(blame[3]).toBe(Entity.SYSTEM); // "   You see a cozy fireplace." from v2
      expect(blame[4]).toBe(Entity.SYSTEM); // "if sit down" from v3
      expect(blame[5]).toBe(Entity.SYSTEM); // "   You rest on the soft couch." from v3

      // Original lines
      expect(blame[0]).not.toBe(Entity.SYSTEM); // "@HOME"
      expect(blame[1]).not.toBe(Entity.SYSTEM); // "The room is warm."
      expect(blame[6]).not.toBe(Entity.SYSTEM); // "@END"
    });
  });

  describe('resolved versions', () => {
    it('should skip resolved AI versions when onlyUnresolved is true', () => {
      const currentScript = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
      
      // AI added lines, but version is resolved
      const aiVersion = makeVersion('v2', Entity.SYSTEM, currentScript, 2000, true);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);
      
      // With onlyUnresolved = true, resolved AI versions should be skipped
      const blame = computeBlame(currentScript, [aiVersion, authorVersion], true);
      
      // AI lines should NOT be attributed to SYSTEM because the version is resolved
      expect(blame[2]).not.toBe(Entity.SYSTEM);
      expect(blame[3]).not.toBe(Entity.SYSTEM);
    });

    it('should include resolved AI versions when onlyUnresolved is false', () => {
      const currentScript = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
      
      // AI added lines, but version is resolved
      const aiVersion = makeVersion('v2', Entity.SYSTEM, currentScript, 2000, true);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);
      
      // With onlyUnresolved = false (default), resolved AI versions should be included
      const blame = computeBlame(currentScript, [aiVersion, authorVersion], false);
      
      // AI lines should be attributed to SYSTEM
      expect(blame[2]).toBe(Entity.SYSTEM);
      expect(blame[3]).toBe(Entity.SYSTEM);
    });

    it('should still show unresolved AI versions when onlyUnresolved is true', () => {
      const currentScript = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
      
      // AI added lines, version is NOT resolved
      const aiVersion = makeVersion('v2', Entity.SYSTEM, currentScript, 2000, false);
      const authorVersion = makeVersion('v1', Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000);
      
      const blame = computeBlame(currentScript, [aiVersion, authorVersion], true);
      
      // AI lines should be attributed to SYSTEM (not resolved)
      expect(blame[2]).toBe(Entity.SYSTEM);
      expect(blame[3]).toBe(Entity.SYSTEM);
    });
  });
});
