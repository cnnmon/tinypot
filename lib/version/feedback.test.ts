import { describe, expect, it } from 'vitest';
import { Id } from '@/convex/_generated/dataModel';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { detectFeedback, detectFeedbackFromVersions, formatGuidebookFeedback } from './feedback';

function makeVersion(
  id: string,
  creator: Entity.AUTHOR | Entity.SYSTEM,
  script: string[],
  createdAt = Date.now(),
): Version {
  return {
    id: id as Id<'versions'>,
    creator,
    createdAt,
    snapshot: { script, guidebook: '' },
  };
}

describe('detectFeedback', () => {
  it('returns null for author-to-author versions', () => {
    const v1 = makeVersion('v1', Entity.AUTHOR, ['@START', 'Hello']);
    const v2 = makeVersion('v2', Entity.AUTHOR, ['@START', 'Hello world']);
    expect(detectFeedback(v1, v2)).toBeNull();
  });

  it('returns null for system-to-system versions', () => {
    const v1 = makeVersion('v1', Entity.SYSTEM, ['@START', 'if run', '  You run.']);
    const v2 = makeVersion('v2', Entity.SYSTEM, ['@START', 'if run fast', '  You run.']);
    expect(detectFeedback(v1, v2)).toBeNull();
  });

  it('detects REMOVE when AI branch is completely removed', () => {
    const aiVersion = makeVersion('v1', Entity.SYSTEM, [
      '@START',
      'You are in a forest.',
      'if climb the tree',
      '  You climb up.',
      '  goto @TREETOP',
    ]);
    const authorVersion = makeVersion('v2', Entity.AUTHOR, ['@START', 'You are in a forest.']);

    const result = detectFeedback(aiVersion, authorVersion);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('REMOVE');
    expect(result?.branch).toContain('climb the tree');
  });

  it('detects EDIT when AI branch content is modified', () => {
    const aiVersion = makeVersion('v1', Entity.SYSTEM, [
      '@START',
      'You are in a forest.',
      'if climb the tree',
      '  You climb up carefully.',
      '  goto @TREETOP',
    ]);
    const authorVersion = makeVersion('v2', Entity.AUTHOR, [
      '@START',
      'You are in a forest.',
      'if climb the tree',
      '  You scramble up the oak tree.',
      '  The view is amazing.',
      '  goto @TREETOP',
    ]);

    const result = detectFeedback(aiVersion, authorVersion);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('EDIT');
    expect(result?.branch).toContain('climb the tree');
  });

  it('returns null when AI branch is unchanged', () => {
    const aiVersion = makeVersion('v1', Entity.SYSTEM, [
      '@START',
      'You are in a forest.',
      'if climb the tree',
      '  You climb up.',
    ]);
    const authorVersion = makeVersion('v2', Entity.AUTHOR, [
      '@START',
      'You are in a forest.',
      'if climb the tree',
      '  You climb up.',
      'The sun is shining.', // Author added narrative, not touched AI branch
    ]);

    const result = detectFeedback(aiVersion, authorVersion);
    expect(result).toBeNull();
  });

  it('detects REMOVE for branch with aliases', () => {
    const aiVersion = makeVersion('v1', Entity.SYSTEM, [
      '@START',
      'if run away | flee | escape',
      '  You run as fast as you can.',
    ]);
    const authorVersion = makeVersion('v2', Entity.AUTHOR, ['@START', 'You stand your ground.']);

    const result = detectFeedback(aiVersion, authorVersion);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('REMOVE');
  });
});

describe('detectFeedbackFromVersions', () => {
  it('returns null for empty versions', () => {
    expect(detectFeedbackFromVersions([])).toBeNull();
  });

  it('returns null for single version', () => {
    const versions = [makeVersion('v1', Entity.AUTHOR, ['@START'])];
    expect(detectFeedbackFromVersions(versions)).toBeNull();
  });

  it('detects pattern when AI version followed by author edit', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v2', Entity.AUTHOR, ['@START', 'Hello'], now),
      makeVersion('v1', Entity.SYSTEM, ['@START', 'Hello', 'if jump', '  You jump.'], now - 1000),
    ];

    const result = detectFeedbackFromVersions(versions);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('REMOVE');
    expect(result?.aiVersionId).toBe('v1');
    expect(result?.authorVersionId).toBe('v2');
  });

  it('returns null when author version followed by AI version', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v2', Entity.SYSTEM, ['@START', 'if fly', '  You fly.'], now),
      makeVersion('v1', Entity.AUTHOR, ['@START', 'Hello'], now - 1000),
    ];

    expect(detectFeedbackFromVersions(versions)).toBeNull();
  });

  it('returns null when author version followed by author version', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v2', Entity.AUTHOR, ['@START', 'World'], now),
      makeVersion('v1', Entity.AUTHOR, ['@START', 'Hello'], now - 1000),
    ];

    expect(detectFeedbackFromVersions(versions)).toBeNull();
  });
});

describe('formatGuidebookFeedback', () => {
  it('formats REMOVE feedback', () => {
    expect(formatGuidebookFeedback('REMOVE', 'climb the tree')).toBe('REMOVE: "climb the tree"');
  });

  it('formats EDIT feedback', () => {
    expect(formatGuidebookFeedback('EDIT', 'run away')).toBe('EDIT: "run away"');
  });

  it('returns empty string for null type', () => {
    expect(formatGuidebookFeedback(null, 'something')).toBe('');
  });
});

describe('real-world scenario: lobby look around', () => {
  // Simulates: Author writes initial script → AI generates branch → Author trims AI content
  it('should have 3 versions: AUTHOR → SYSTEM → AUTHOR, and detect EDIT feedback', () => {
    const now = Date.now();

    // v1: Initial author script
    const v1 = makeVersion(
      'v1',
      Entity.AUTHOR,
      ['I duck my head into the lobby.'],
      now - 2000,
    );

    // v2: AI generates "look around" branch with verbose content
    const v2 = makeVersion(
      'v2',
      Entity.SYSTEM,
      [
        'I duck my head into the lobby.',
        'if look around',
        '  You take in the lobby around you. Pale afternoon light filters through tall windows, casting long shadows across polished floors. The space is quiet—perhaps too quiet. Ahead, you notice a few potential paths forward, but nothing immediately demands your attention.',
        '  What do you do?',
      ],
      now - 1000,
    );

    // v3: Author trims AI content to keep only essentials
    const v3 = makeVersion(
      'v3',
      Entity.AUTHOR,
      [
        'I duck my head into the lobby.',
        'if look around',
        '  You take in the lobby around you.',
        '  What do you do?',
      ],
      now,
    );

    // Verify there are 3 versions with correct creators
    const versions = [v3, v2, v1]; // newest first
    expect(versions).toHaveLength(3);
    expect(versions[0].creator).toBe(Entity.AUTHOR);
    expect(versions[1].creator).toBe(Entity.SYSTEM);
    expect(versions[2].creator).toBe(Entity.AUTHOR);

    // Detect feedback between AI version and author's edit
    const feedback = detectFeedback(v2, v3);
    expect(feedback).not.toBeNull();
    expect(feedback?.type).toBe('EDIT');
    expect(feedback?.branch).toContain('look around');

    // detectFeedbackFromVersions should also work
    const feedbackFromVersions = detectFeedbackFromVersions(versions);
    expect(feedbackFromVersions).not.toBeNull();
    expect(feedbackFromVersions?.type).toBe('EDIT');
    expect(feedbackFromVersions?.aiVersionId).toBe('v2');
    expect(feedbackFromVersions?.authorVersionId).toBe('v3');
  });
});
