import { EntryType } from '@/types/schema';
import { describe, expect, it } from 'vitest';
import { addAliasToOption, addGeneratedOptionToScript, parseIntoSchema } from './index';

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

      const result = addGeneratedOptionToScript(lines, 'ROOM', 'examine the room', [], ['Nothing special.']);

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
      const lines = ['[image: https://example.com/room.png]', "You're in a mysterious room.", 'The door is locked.'];

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

      const result = addGeneratedOptionToScript(lines, 'START', 'examine the walls', [], ['The walls are bare.']);

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

  describe('explicit scene at start of file', () => {
    it('should add option to HOME scene when it is the first scene', () => {
      const lines = [
        '@HOME',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room. You see a chair, a desk, and a plant.",
        'if leave & [key]',
        '  You did it!',
        '  goto @END',
        'if examine the desk',
        '  You lean closer to the desk.',
        '  goto @DESK',
      ];

      const result = addGeneratedOptionToScript(
        lines,
        'HOME',
        'look around',
        [],
        ['You scan the room more carefully.', 'So... what now?'],
      );

      // New option should be added AFTER existing options in HOME, not before @HOME
      expect(result).toEqual([
        '@HOME',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room. You see a chair, a desk, and a plant.",
        'if leave & [key]',
        '  You did it!',
        '  goto @END',
        'if examine the desk',
        '  You lean closer to the desk.',
        '  goto @DESK',
        'if look around',
        '   You scan the room more carefully.',
        '   So... what now?',
      ]);
    });

    it('should add option when START is passed but script starts with @HOME', () => {
      // This is the bug case: player is in "START" but script starts with @HOME
      // The option should go inside HOME, not before it
      const lines = [
        '@HOME',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room. You see a chair, a desk, and a plant.",
        'if leave & [key]',
        '  You did it!',
        '  goto @END',
        'if examine the desk',
        '  You lean closer to the desk.',
        '  goto @DESK',
      ];

      const result = addGeneratedOptionToScript(
        lines,
        'START', // Player's currentSceneId is still 'START'
        'look around',
        [],
        ['You scan the room more carefully.', 'So... what now?'],
      );

      // New option should be added INSIDE HOME (after existing options), not before @HOME
      expect(result).toEqual([
        '@HOME',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room. You see a chair, a desk, and a plant.",
        'if leave & [key]',
        '  You did it!',
        '  goto @END',
        'if examine the desk',
        '  You lean closer to the desk.',
        '  goto @DESK',
        'if look around',
        '   You scan the room more carefully.',
        '   So... what now?',
      ]);
    });

    it('should add option to HOME scene even with empty lines or whitespace before it', () => {
      // Sometimes scripts might have leading whitespace or empty lines
      const lines = [
        '',
        '@HOME',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room.",
        'if examine the desk',
        '  You lean closer.',
      ];

      const result = addGeneratedOptionToScript(lines, 'HOME', 'look around', [], ['You scan the room.']);

      expect(result).toEqual([
        '',
        '@HOME',
        '[image: https://i.imgur.com/PR6oN9P.png]',
        "You're in a room.",
        'if examine the desk',
        '  You lean closer.',
        'if look around',
        '   You scan the room.',
      ]);
    });
  });
});

describe('addAliasToOption - nested options', () => {
  it('should add alias to nested option inside conditional', () => {
    const lines = [
      '@DESK',
      '[if: !key]',
      '  [image: https://example.com/key.png]',
      '  Take the key?',
      '  if take the key',
      '    Yoink!',
      '    goto @KEY',
      '  if leave it',
      '    You step back.',
      'if leave',
      '  goto @HOME',
    ];

    const result = addAliasToOption(lines, 'take the key', 'yes');

    expect(result).toEqual([
      '@DESK',
      '[if: !key]',
      '  [image: https://example.com/key.png]',
      '  Take the key?',
      '  if take the key | yes',
      '    Yoink!',
      '    goto @KEY',
      '  if leave it',
      '    You step back.',
      'if leave',
      '  goto @HOME',
    ]);
  });

  it('should add alias to deeply nested option', () => {
    const lines = [
      '@ROOM',
      '[if: door_open]',
      '  You see the open door.',
      '  [if: has_key]',
      '    if unlock chest',
      '      You unlock the chest.',
      'if look around',
      '  Nothing special.',
    ];

    const result = addAliasToOption(lines, 'unlock chest', 'open chest');

    expect(result[4]).toBe('    if unlock chest | open chest');
  });
});

describe('parseIntoSchema - star syntax for indentation', () => {
  it('should convert * to one level of indentation', () => {
    const lines = ['@DESK', 'Take the key?', 'if take the key', '* Yoink!', '* goto @HOME'];

    const schema = parseIntoSchema(lines);

    expect(schema.length).toBe(3); // SCENE, NARRATIVE, OPTION
    const option = schema[2];
    if (option.type === EntryType.OPTION) {
      expect(option.then.length).toBe(2); // Yoink! and goto
    }
  });

  it('should convert ** to two levels of indentation', () => {
    const lines = ['@DESK', '[if: !key]', '* Take the key?', '* if take the key', '** Yoink!', '** goto @HOME'];

    const schema = parseIntoSchema(lines);

    // SCENE, CONDITIONAL
    expect(schema.length).toBe(2);
    const conditional = schema[1];
    if (conditional.type === EntryType.CONDITIONAL) {
      // then block: NARRATIVE, OPTION
      expect(conditional.then.length).toBe(2);
      const nestedOption = conditional.then[1];
      if (nestedOption.type === EntryType.OPTION) {
        expect(nestedOption.text).toBe('take the key');
        expect(nestedOption.then.length).toBe(2);
      }
    }
  });

  it('should handle mixed stars and spaces at same level', () => {
    // Both '  ' (2 spaces) and '*' (1 star = 2 spaces) are equivalent
    const lines = [
      '@ROOM',
      'if look around',
      '  You see a key.', // 2 space indent
      '* if [key]', // 1 star = 2 spaces (same level as above)
      '** You already have the key.', // 2 stars = 4 spaces (nested in conditional)
    ];

    const schema = parseIntoSchema(lines);

    expect(schema.length).toBe(2); // SCENE, OPTION
    const option = schema[1];
    if (option.type === EntryType.OPTION) {
      // option.then has: narrative, conditional
      // The "if [key]" at same level becomes a conditional in the then block
      expect(option.then.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('parseIntoSchema - inline allows on scenes', () => {
  it('should parse scene with [allows: new]', () => {
    const lines = ['@GARDEN [allows: new]', 'The flowers sway gently.'];

    const schema = parseIntoSchema(lines);

    expect(schema.length).toBe(2);
    expect(schema[0].type).toBe(EntryType.SCENE);
    if (schema[0].type === EntryType.SCENE) {
      expect(schema[0].label).toBe('GARDEN');
      expect(schema[0].allows).toBe('new');
    }
  });

  it('should parse scene with [allows: link]', () => {
    const lines = ['@HUB [allows: link]', 'Choose your destination.'];

    const schema = parseIntoSchema(lines);

    expect(schema[0].type).toBe(EntryType.SCENE);
    if (schema[0].type === EntryType.SCENE) {
      expect(schema[0].label).toBe('HUB');
      expect(schema[0].allows).toBe('link');
    }
  });

  it('should parse scene with [allows: text]', () => {
    const lines = ['@INTRO [allows: text]', 'What do you want to do?'];

    const schema = parseIntoSchema(lines);

    expect(schema[0].type).toBe(EntryType.SCENE);
    if (schema[0].type === EntryType.SCENE) {
      expect(schema[0].label).toBe('INTRO');
      expect(schema[0].allows).toBe('text');
    }
  });

  it('should parse scene without allows (undefined)', () => {
    const lines = ['@ROOM', 'A simple room.'];

    const schema = parseIntoSchema(lines);

    expect(schema[0].type).toBe(EntryType.SCENE);
    if (schema[0].type === EntryType.SCENE) {
      expect(schema[0].label).toBe('ROOM');
      expect(schema[0].allows).toBeUndefined();
    }
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
