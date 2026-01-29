import { describe, expect, it } from 'vitest';
import { Id } from '@/convex/_generated/dataModel';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { coalesceVersions } from './index';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function makeVersion(
  id: string,
  creator: Entity.AUTHOR | Entity.SYSTEM,
  createdAt: number,
  script: string[] = ['test'],
): Version {
  return {
    id: id as Id<'versions'>,
    creator,
    createdAt,
    snapshot: { script, guidebook: '' },
  };
}

describe('coalesceVersions', () => {
  it('returns empty array for empty input', () => {
    expect(coalesceVersions([])).toEqual([]);
  });

  it('returns single version unchanged', () => {
    const versions = [makeVersion('v1', Entity.AUTHOR, 1000)];
    expect(coalesceVersions(versions)).toHaveLength(1);
    expect(coalesceVersions(versions)[0].id).toBe('v1');
  });

  it('coalesces versions by same creator within 1 hour session (default)', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v3', Entity.AUTHOR, now, ['line3']),
      makeVersion('v2', Entity.AUTHOR, now - 30 * MINUTE, ['line2']), // 30 min ago
      makeVersion('v1', Entity.AUTHOR, now - 45 * MINUTE, ['line1']), // 45 min ago
    ];

    // Default 1 hour window should coalesce all
    const result = coalesceVersions(versions);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('v3');
  });

  it('does not coalesce versions outside 1 hour session', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v2', Entity.AUTHOR, now, ['line2']),
      makeVersion('v1', Entity.AUTHOR, now - 2 * HOUR, ['line1']), // 2 hours ago
    ];

    const result = coalesceVersions(versions);
    expect(result).toHaveLength(2);
  });

  it('does not coalesce versions by different creators even within session', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v3', Entity.AUTHOR, now, ['line3']),
      makeVersion('v2', Entity.SYSTEM, now - 10 * MINUTE, ['line2']), // AI edit
      makeVersion('v1', Entity.AUTHOR, now - 20 * MINUTE, ['line1']),
    ];

    // Different creators = separate entries
    const result = coalesceVersions(versions);
    expect(result).toHaveLength(3);
  });

  it('handles mixed sessions correctly', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v5', Entity.AUTHOR, now, ['line5']), // Session 1
      makeVersion('v4', Entity.AUTHOR, now - 20 * MINUTE, ['line4']), // Session 1 (coalesced)
      makeVersion('v3', Entity.SYSTEM, now - 90 * MINUTE, ['line3']), // Session 2 (AI)
      makeVersion('v2', Entity.SYSTEM, now - 100 * MINUTE, ['line2']), // Session 2 (coalesced)
      makeVersion('v1', Entity.AUTHOR, now - 3 * HOUR, ['line1']), // Session 3
    ];

    const result = coalesceVersions(versions);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('v5');
    expect(result[1].id).toBe('v3');
    expect(result[2].id).toBe('v1');
  });

  // Deduplication tests
  it('filters out versions with identical content', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v3', Entity.AUTHOR, now, ['same']),
      makeVersion('v2', Entity.AUTHOR, now - 2 * HOUR, ['same']), // same content, should be removed
      makeVersion('v1', Entity.AUTHOR, now - 4 * HOUR, ['different']),
    ];

    const result = coalesceVersions(versions);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('v3');
    expect(result[1].id).toBe('v1');
  });

  it('keeps all versions when content differs across sessions', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v3', Entity.AUTHOR, now, ['a']),
      makeVersion('v2', Entity.AUTHOR, now - 2 * HOUR, ['b']),
      makeVersion('v1', Entity.AUTHOR, now - 4 * HOUR, ['c']),
    ];

    const result = coalesceVersions(versions);
    expect(result).toHaveLength(3);
  });

  it('handles consecutive duplicates within session correctly', () => {
    const now = Date.now();
    const versions = [
      makeVersion('v5', Entity.AUTHOR, now, ['final']),
      makeVersion('v4', Entity.AUTHOR, now - 10 * MINUTE, ['same']),
      makeVersion('v3', Entity.AUTHOR, now - 20 * MINUTE, ['same']),
      makeVersion('v2', Entity.AUTHOR, now - 30 * MINUTE, ['same']),
      makeVersion('v1', Entity.AUTHOR, now - 2 * HOUR, ['first']),
    ];

    // v4, v3, v2 have same content - only v4 remains after dedup
    // v5 and v4 are within 1hr session -> coalesce to v5
    // v1 is in different session
    const result = coalesceVersions(versions);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('v5');
    expect(result[1].id).toBe('v1');
  });
});
