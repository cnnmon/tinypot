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
  ): Version => ({
    id: id as any,
    creator,
    createdAt,
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
});
