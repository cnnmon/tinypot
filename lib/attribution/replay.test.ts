import { describe, expect, it } from 'vitest';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { replayVersions } from './index';

// Helper to create a version. Stored shape mirrors Convex (newest-first).
const v = (
  creator: Entity.AUTHOR | Entity.SYSTEM,
  script: string[],
  createdAt: number,
  resolved?: boolean,
): Version => ({
  id: `v${createdAt}` as Version['id'],
  creator,
  createdAt,
  resolved,
  snapshot: { script, guidebook: '' },
});

describe('replayVersions', () => {
  it('marks everything base when there are no versions', () => {
    const doc = replayVersions([], ['@HOME', 'hi']);
    expect(doc.source).toEqual(['base', 'base']);
  });

  it('attributes AI-added lines to ai', () => {
    const current = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
    const versions: Version[] = [
      v(Entity.SYSTEM, current, 2000), // newest
      v(Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000),
    ];
    const doc = replayVersions(versions, current);
    expect(doc.source).toEqual(['human', 'human', 'ai', 'ai']);
  });

  it('does not attribute shifted original lines to ai', () => {
    const original = ['@HOME', 'The fire burns.', '@BIKE', 'You ride into the sunset.', 'goto @END'];
    const current = [
      '@HOME',
      'The fire burns.',
      'if look around',
      '  You see dancing shadows.',
      '@BIKE',
      'You ride into the sunset.',
      'goto @END',
    ];
    const versions: Version[] = [v(Entity.SYSTEM, current, 2000), v(Entity.AUTHOR, original, 1000)];
    const doc = replayVersions(versions, current);
    expect(doc.source).toEqual(['human', 'human', 'ai', 'ai', 'human', 'human', 'human']);
  });

  it('downgrades AI lines edited by the author to human', () => {
    const v1Script = ['@HOME', 'The fire burns.'];
    const aiScript = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
    const authorEdited = ['@HOME', 'The fire burns.', 'if look around', '  You see dancing shadows.'];
    const versions: Version[] = [
      v(Entity.AUTHOR, authorEdited, 3000), // newest
      v(Entity.SYSTEM, aiScript, 2000),
      v(Entity.AUTHOR, v1Script, 1000),
    ];
    const doc = replayVersions(versions, authorEdited);
    // 'if look around' is still AI (unchanged); the edited response is human.
    expect(doc.source[2]).toBe('ai');
    expect(doc.source[3]).toBe('human');
  });

  it('does not blame duplicate lines that already existed', () => {
    const original = ['@HOME', 'What do you want to do?', 'if go outside', '  You step outside.', '  What do you want to do?'];
    const current = [
      '@HOME',
      'What do you want to do?',
      'if go outside',
      '  You step outside.',
      '  What do you want to do?',
      'if look around',
      '  You glance around.',
      '  What do you want to do?',
    ];
    const versions: Version[] = [v(Entity.SYSTEM, current, 2000), v(Entity.AUTHOR, original, 1000)];
    const doc = replayVersions(versions, current);
    expect(doc.source[5]).toBe('ai');
    expect(doc.source[6]).toBe('ai');
    expect(doc.source[7]).toBe('ai');
    expect(doc.source.slice(0, 5).every((s) => s !== 'ai')).toBe(true);
  });

  it('treats resolved AI versions as base when treatResolvedAsBase=true', () => {
    const current = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
    const versions: Version[] = [
      v(Entity.SYSTEM, current, 2000, true), // resolved
      v(Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000),
    ];
    const doc = replayVersions(versions, current, { treatResolvedAsBase: true });
    expect(doc.source[2]).toBe('base');
    expect(doc.source[3]).toBe('base');
  });

  it('keeps resolved AI versions as ai when treatResolvedAsBase=false', () => {
    const current = ['@HOME', 'The fire burns.', 'if look around', '  You see things.'];
    const versions: Version[] = [
      v(Entity.SYSTEM, current, 2000, true),
      v(Entity.AUTHOR, ['@HOME', 'The fire burns.'], 1000),
    ];
    const doc = replayVersions(versions, current);
    expect(doc.source[2]).toBe('ai');
    expect(doc.source[3]).toBe('ai');
  });

  it('applies unversioned edits as a trailing human tick', () => {
    const versioned = ['@HOME', 'hi'];
    const current = ['@HOME', 'hi there'];
    const versions: Version[] = [v(Entity.AUTHOR, versioned, 1000)];
    const doc = replayVersions(versions, current);
    expect(doc.source).toEqual(['human', 'human']);
  });

  it('correctly handles AI adding "if" + indented response before next scene', () => {
    const original = ['@HOME', 'The fire crackles softly.', '@GARDEN', 'Flowers sway in the breeze.'];
    const current = [
      '@HOME',
      'The fire crackles softly.',
      'if look around',
      '   You notice shadows dancing on the walls.',
      '@GARDEN',
      'Flowers sway in the breeze.',
    ];
    const versions: Version[] = [v(Entity.SYSTEM, current, 2000), v(Entity.AUTHOR, original, 1000)];
    const doc = replayVersions(versions, current);
    expect(doc.source[2]).toBe('ai');
    expect(doc.source[3]).toBe('ai');
    expect(doc.source[4]).not.toBe('ai'); // @GARDEN must stay base
    expect(doc.source[5]).not.toBe('ai');
  });
});
