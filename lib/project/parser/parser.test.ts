import { EntryType } from '@/types/schema';
import { describe, expect, it } from 'vitest';
import { addGeneratedOptionToScript, parseIntoSchema } from './index';

describe('addGeneratedOptionToScript', () => {
  describe('script with explicit scenes', () => {
    it('should add option after existing choices in target scene', () => {
      const lines = [
        '@ROOM',
        'You are in a room.',
        'if look around',
        '   You see a door.',
        '@HALLWAY',
        'A long hallway.',
      ];

      const result = addGeneratedOptionToScript(
        lines,
        'ROOM',
        'open the door',
        ['try the door'],
        ['The door opens.', 'goto @HALLWAY'],
      );

      expect(result).toEqual([
        '@ROOM',
        'You are in a room.',
        'if look around',
        '   You see a door.',
        'if open the door | try the door',
        '   The door opens.',
        '   goto @HALLWAY',
        '@HALLWAY',
        'A long hallway.',
      ]);
    });

    it('should add option in scene with no existing choices', () => {
      const lines = ['@ROOM', 'You are in a room.', '@HALLWAY', 'A long hallway.'];

      const result = addGeneratedOptionToScript(
        lines,
        'ROOM',
        'examine the room',
        [],
        ['Nothing special.'],
      );

      expect(result).toEqual([
        '@ROOM',
        'You are in a room.',
        'if examine the room',
        '   Nothing special.',
        '@HALLWAY',
        'A long hallway.',
      ]);
    });
  });

  describe('START scene (no explicit scene label)', () => {
    it('should add option after existing choices in implicit START scene', () => {
      const lines = [
        '[sets: bike]',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room. You see a chair, a desk, and a plant.",
        'if examine the desk | look at desk',
        '   You lean closer to the desk.',
        '   goto @DESK',
        'if look at plant | check plant',
        "   It's a potted plant.",
      ];

      const result = addGeneratedOptionToScript(
        lines,
        'START',
        'sit in the chair',
        ['use chair', 'take a seat'],
        ['You sit down in the chair.'],
      );

      // The new option should be added after the last existing option
      expect(result).toEqual([
        '[sets: bike]',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room. You see a chair, a desk, and a plant.",
        'if examine the desk | look at desk',
        '   You lean closer to the desk.',
        '   goto @DESK',
        'if look at plant | check plant',
        "   It's a potted plant.",
        'if sit in the chair | use chair | take a seat',
        '   You sit down in the chair.',
      ]);
    });

    it('should add option in implicit START scene with no existing choices', () => {
      const lines = [
        '[image: https://example.com/room.png]',
        "You're in a mysterious room.",
        'The door is locked.',
      ];

      const result = addGeneratedOptionToScript(
        lines,
        'START',
        'examine the door',
        ['look at door'],
        ['The door has a keyhole.'],
      );

      expect(result).toEqual([
        '[image: https://example.com/room.png]',
        "You're in a mysterious room.",
        'The door is locked.',
        'if examine the door | look at door',
        '   The door has a keyhole.',
      ]);
    });

    it('should add option in START scene when script has later scenes', () => {
      const lines = [
        "You're in a room.",
        'if look around',
        '   You see a key on the desk.',
        '@DESK',
        'You approach the desk.',
        'if take the key',
        '   You pick up the key.',
      ];

      const result = addGeneratedOptionToScript(
        lines,
        'START',
        'examine the walls',
        [],
        ['The walls are bare.'],
      );

      // New option should be added after 'look around' option, before @DESK
      expect(result).toEqual([
        "You're in a room.",
        'if look around',
        '   You see a key on the desk.',
        'if examine the walls',
        '   The walls are bare.',
        '@DESK',
        'You approach the desk.',
        'if take the key',
        '   You pick up the key.',
      ]);
    });

    it('should handle START scene with only narrative (no choices, no later scenes)', () => {
      const lines = ['You wake up in darkness.', "You can't see anything."];

      const result = addGeneratedOptionToScript(
        lines,
        'START',
        'feel around',
        ['grope in the dark'],
        ['Your hands touch cold stone.'],
      );

      expect(result).toEqual([
        'You wake up in darkness.',
        "You can't see anything.",
        'if feel around | grope in the dark',
        '   Your hands touch cold stone.',
      ]);
    });
  });

  describe('option without aliases', () => {
    it('should add option without alias separator', () => {
      const lines = ['You are here.'];

      const result = addGeneratedOptionToScript(lines, 'START', 'leave', [], ['You leave.']);

      expect(result).toEqual(['You are here.', 'if leave', '   You leave.']);
    });
  });
});

describe('parseIntoSchema - nested options in conditionals', () => {
  it('should parse options nested inside conditionals', () => {
    const lines = [
      '@DESK',
      '[if: !key]',
      '  [image: https://example.com/key.png]',
      '  Take the key?',
      '  if take the key | yes',
      '    Yoink!',
      '    goto @KEY',
      '  if leave it | no',
      '    You step back.',
      'if leave | go',
      '  goto @HOME',
    ];

    const schema = parseIntoSchema(lines);

    // Should have: SCENE, CONDITIONAL, OPTION (leave)
    expect(schema.length).toBe(3);
    expect(schema[0].type).toBe(EntryType.SCENE);
    expect(schema[1].type).toBe(EntryType.CONDITIONAL);
    expect(schema[2].type).toBe(EntryType.OPTION);

    // The conditional should contain nested options
    const conditional = schema[1];
    if (conditional.type === EntryType.CONDITIONAL) {
      // Then block should have: IMAGE, NARRATIVE, OPTION, OPTION
      expect(conditional.then.length).toBe(4);
      expect(conditional.then[0].type).toBe(EntryType.IMAGE);
      expect(conditional.then[1].type).toBe(EntryType.NARRATIVE);
      expect(conditional.then[2].type).toBe(EntryType.OPTION);
      expect(conditional.then[3].type).toBe(EntryType.OPTION);

      // Verify nested option has its then block
      const nestedOption = conditional.then[2];
      if (nestedOption.type === EntryType.OPTION) {
        expect(nestedOption.text).toBe('take the key');
        expect(nestedOption.then.length).toBe(2); // Yoink! and goto
      }
    }
  });
});
