import { createInitialGameState, refreshGameOptions } from '@/lib/game';
import { LineType } from '@/types/schema';
import { describe, expect, it } from 'vitest';
import { parseIntoSchema } from './index';

describe('parseIntoSchema', () => {
  it('parses special characters in narrative correctly', () => {
    const lines = ['Hello [world]!', '(parentheses work)', '{curly braces}', '<angle brackets>'];

    const schema = parseIntoSchema(lines);

    expect(schema).toHaveLength(4);
    expect(schema.every((s) => s.type === LineType.NARRATIVE)).toBe(true);
  });
});

describe('editLines integration', () => {
  it('inserting a line before options should NOT end the game', () => {
    // Start with original script
    const lines = [
      '# FIRE',
      'The fire burns brightly.',
      '~ Ride a bike',
      "   That's cool!",
      '   > BIKE',
      '~ Run away',
      '   Weirdo…',
      '# BIKE',
      'Learn to sail',
      '> END',
    ];

    // Parse and run game to options
    const schema = parseIntoSchema(lines);
    let gameState = createInitialGameState(schema);

    // Should be at options
    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions.length).toBe(2);
    expect(gameState.currentOptions[0].text).toBe('Ride a bike');

    // USER TYPES: Insert a new line before options (index 2)
    lines.splice(2, 0, "[ADDED: It's hard to tell]");

    // Re-parse and refresh (this is what editLines does)
    const newSchema = parseIntoSchema(lines);
    gameState = refreshGameOptions(newSchema, gameState);

    // Game should NOT have ended
    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions.length).toBe(2);
    expect(gameState.currentOptions[0].text).toBe('Ride a bike');
    expect(gameState.currentOptions[1].text).toBe('Run away');

    // The new narrative line should be in the schema
    expect(newSchema[2]).toEqual({ type: LineType.NARRATIVE, text: "[ADDED: It's hard to tell]" });
  });

  it('removing a line before options should NOT end the game', () => {
    const lines = [
      '# FIRE',
      'The fire burns brightly.',
      'Extra line here.',
      '~ Ride a bike',
      "   That's cool!",
      '~ Run away',
      '   Weirdo…',
    ];

    const schema = parseIntoSchema(lines);
    let gameState = createInitialGameState(schema);

    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions.length).toBe(2);

    // USER DELETES: Remove the extra line (index 2)
    lines.splice(2, 1);

    const newSchema = parseIntoSchema(lines);
    gameState = refreshGameOptions(newSchema, gameState);

    // Should still be at options
    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions.length).toBe(2);
  });

  it('editing option text should update the options', () => {
    const lines = ['# START', 'Hello!', '~ Option A', '~ Option B'];

    const schema = parseIntoSchema(lines);
    let gameState = createInitialGameState(schema);

    expect(gameState.currentOptions[0].text).toBe('Option A');

    // USER EDITS: Change option text
    lines[2] = '~ Changed Option A';

    const newSchema = parseIntoSchema(lines);
    gameState = refreshGameOptions(newSchema, gameState);

    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions[0].text).toBe('Changed Option A');
  });

  it('adding multiple lines while at options should keep game running', () => {
    const lines = ['# SCENE', 'Some text.', '~ Choice 1', '~ Choice 2'];

    const schema = parseIntoSchema(lines);
    let gameState = createInitialGameState(schema);

    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions.length).toBe(2);

    // USER TYPES: Add several lines before options
    lines.splice(2, 0, 'Line A', 'Line B', 'Line C');

    const newSchema = parseIntoSchema(lines);
    gameState = refreshGameOptions(newSchema, gameState);

    expect(gameState.isEnded).toBe(false);
    expect(gameState.currentOptions.length).toBe(2);
    expect(gameState.currentOptions[0].text).toBe('Choice 1');
  });
});
