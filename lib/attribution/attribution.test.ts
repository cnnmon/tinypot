import { describe, expect, it } from 'vitest';
import { applyEdit, applyHumanEdit, insertAiBranch, lineLcs, makeDoc, Source } from './index';

const srcs = (doc: { source: Source[] }) => doc.source.join(',');

describe('lineLcs', () => {
  it('matches identical arrays', () => {
    expect([...lineLcs(['a', 'b'], ['a', 'b'])]).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('skips inserted lines', () => {
    expect([...lineLcs(['a', 'c'], ['a', 'b', 'c'])]).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it('prefers earliest match for duplicates', () => {
    expect([...lineLcs(['x', 'x'], ['x', 'x', 'x'])]).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });
});

describe('attribution: AI inserts content', () => {
  it('marks AI-added lines green (ai)', () => {
    let doc = makeDoc(['@HOME', 'The fire crackles.'], 'base');
    doc = insertAiBranch(doc, 1, ['if look around', '   You notice shadows.']);
    expect(doc.lines).toEqual(['@HOME', 'The fire crackles.', 'if look around', '   You notice shadows.']);
    expect(srcs(doc)).toBe('base,base,ai,ai');
  });

  it('keeps prior lines untouched when AI inserts', () => {
    let doc = makeDoc(['@HOME', 'The fire crackles.', '@GARDEN', 'Flowers sway.'], 'base');
    doc = insertAiBranch(doc, 1, ['if look around', '   You notice shadows.']);
    expect(srcs(doc)).toBe('base,base,ai,ai,base,base');
  });
});

describe('attribution: human edits an AI line', () => {
  it('downgrades a modified AI line to human (yellow)', () => {
    let doc = makeDoc(['@HOME'], 'base');
    doc = insertAiBranch(doc, 0, ['You see shadows.']);
    expect(srcs(doc)).toBe('base,ai');

    doc = applyHumanEdit(doc, ['@HOME', 'You see shadows in the corner.']);
    expect(srcs(doc)).toBe('base,human');
  });

  it('leaves untouched AI siblings green', () => {
    let doc = makeDoc(['@HOME'], 'base');
    doc = insertAiBranch(doc, 0, ['if look', '   You see shadows.', '   The fire dims.']);
    expect(srcs(doc)).toBe('base,ai,ai,ai');

    doc = applyHumanEdit(doc, ['@HOME', 'if look', '   You see DEEP shadows.', '   The fire dims.']);
    expect(srcs(doc)).toBe('base,ai,human,ai');
  });
});

describe('attribution: backspacing', () => {
  it('mid-line backspace -> human (yellow)', () => {
    let doc = makeDoc([''], 'base');
    doc = applyEdit(doc, ['Hello'], 'ai'); // AI writes a line
    expect(srcs(doc)).toBe('ai');

    doc = applyHumanEdit(doc, ['Hell']); // human deletes one char
    expect(srcs(doc)).toBe('human');
  });

  it('deleting an entire AI line removes its attribution', () => {
    let doc = makeDoc(['@HOME'], 'base');
    doc = insertAiBranch(doc, 0, ['ai line a', 'ai line b']);
    expect(srcs(doc)).toBe('base,ai,ai');

    doc = applyHumanEdit(doc, ['@HOME', 'ai line b']); // human deletes "ai line a"
    expect(doc.lines).toEqual(['@HOME', 'ai line b']);
    expect(srcs(doc)).toBe('base,ai');
  });

  it('backspace-joining two lines makes the merged line human', () => {
    let doc = makeDoc(['@HOME'], 'base');
    doc = insertAiBranch(doc, 0, ['line one', 'line two']);
    expect(srcs(doc)).toBe('base,ai,ai');

    // Backspace at start of "line two" joins onto "line one"
    doc = applyHumanEdit(doc, ['@HOME', 'line oneline two']);
    expect(srcs(doc)).toBe('base,human');
  });

  it('typing then backspacing back stays human, not green', () => {
    // Once a human touches an AI line, they own it even if they backspace
    // back to the original text. Attribution is computed tick-to-tick.
    let doc = makeDoc([''], 'base');
    doc = applyEdit(doc, ['Hello'], 'ai');
    expect(srcs(doc)).toBe('ai');

    doc = applyHumanEdit(doc, ['HelloX']);
    expect(srcs(doc)).toBe('human');

    doc = applyHumanEdit(doc, ['Hello']); // backspaced X
    expect(srcs(doc)).toBe('human');
  });
});

describe('attribution: adding new human lines', () => {
  it('a brand new line typed by the human is yellow', () => {
    let doc = makeDoc(['@HOME', 'fire crackles'], 'base');
    doc = applyHumanEdit(doc, ['@HOME', 'fire crackles', 'wind blows']);
    expect(srcs(doc)).toBe('base,base,human');
  });

  it('splitting an AI line with Enter -> the original prefix keeps ai, new suffix is human', () => {
    let doc = makeDoc([''], 'base');
    doc = applyEdit(doc, ['Hello world'], 'ai');
    // Human hits Enter between "Hello" and " world" -> two lines, content differs
    doc = applyHumanEdit(doc, ['Hello', ' world']);
    // Neither half matches "Hello world" exactly -> both are human
    expect(srcs(doc)).toBe('human,human');
  });
});

describe('attribution: AI generation on top of human content', () => {
  it('keeps human lines yellow while marking new AI lines green', () => {
    let doc = makeDoc(['@HOME'], 'base');
    doc = applyHumanEdit(doc, ['@HOME', 'I wrote this']);
    expect(srcs(doc)).toBe('base,human');

    doc = insertAiBranch(doc, 1, ['if explore', '   New AI prose.']);
    expect(srcs(doc)).toBe('base,human,ai,ai');
  });
});
