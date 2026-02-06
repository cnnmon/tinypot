import { describe, expect, it } from 'vitest';
import { computeLcsMapping, findAddedIndices, normalizeLine } from './diff';

describe('normalizeLine', () => {
  it('should trim and lowercase', () => {
    expect(normalizeLine('  Hello World  ')).toBe('hello world');
    expect(normalizeLine('@HOME')).toBe('@home');
  });
});

describe('computeLcsMapping', () => {
  it('should map identical arrays', () => {
    const arr = ['a', 'b', 'c'];
    const mapping = computeLcsMapping(arr, arr);
    expect(mapping.get(0)).toBe(0);
    expect(mapping.get(1)).toBe(1);
    expect(mapping.get(2)).toBe(2);
  });

  it('should handle insertions in target', () => {
    const source = ['a', 'c'];
    const target = ['a', 'b', 'c'];
    const mapping = computeLcsMapping(source, target);
    expect(mapping.get(0)).toBe(0); // a -> a
    expect(mapping.get(1)).toBe(2); // c -> c (index 2 in target)
  });

  it('should prefer earlier matches for duplicates', () => {
    const source = ['x', 'x'];
    const target = ['x', 'x', 'x'];
    const mapping = computeLcsMapping(source, target);
    // Should match source[0] to target[0], source[1] to target[1]
    expect(mapping.get(0)).toBe(0);
    expect(mapping.get(1)).toBe(1);
  });

  it('should handle complex duplicate scenario', () => {
    const source = ['a', 'dup', 'b', 'dup'];
    const target = ['a', 'dup', 'b', 'dup', 'c', 'dup'];
    const mapping = computeLcsMapping(source, target);
    // Should match in order: source[0]->target[0], source[1]->target[1], etc.
    expect(mapping.get(0)).toBe(0); // a
    expect(mapping.get(1)).toBe(1); // first dup
    expect(mapping.get(2)).toBe(2); // b
    expect(mapping.get(3)).toBe(3); // second dup
  });
});

describe('findAddedIndices', () => {
  it('should find no additions when arrays are identical', () => {
    const arr = ['a', 'b', 'c'];
    const added = findAddedIndices(arr, arr);
    expect(added.size).toBe(0);
  });

  it('should find additions at the end', () => {
    const before = ['a', 'b'];
    const after = ['a', 'b', 'c', 'd'];
    const added = findAddedIndices(before, after);
    expect(added.has(2)).toBe(true);
    expect(added.has(3)).toBe(true);
    expect(added.size).toBe(2);
  });

  it('should find additions in the middle', () => {
    const before = ['a', 'c'];
    const after = ['a', 'b', 'c'];
    const added = findAddedIndices(before, after);
    expect(added.has(1)).toBe(true);
    expect(added.size).toBe(1);
  });

  it('should not mark existing duplicates as added', () => {
    const before = ['@home', 'what?', 'if go', 'step', 'what?'];
    const after = ['@home', 'what?', 'if go', 'step', 'what?', 'if look', 'glance', 'what?'];
    const added = findAddedIndices(before, after);
    // Only indices 5, 6, 7 should be added
    expect(added.has(0)).toBe(false);
    expect(added.has(1)).toBe(false);
    expect(added.has(2)).toBe(false);
    expect(added.has(3)).toBe(false);
    expect(added.has(4)).toBe(false);
    expect(added.has(5)).toBe(true); // if look
    expect(added.has(6)).toBe(true); // glance
    expect(added.has(7)).toBe(true); // third what?
  });

  it('should ignore empty lines', () => {
    const before = ['a', 'b'];
    const after = ['a', '', 'b'];
    const added = findAddedIndices(before, after);
    expect(added.has(1)).toBe(false); // empty line ignored
  });
});
