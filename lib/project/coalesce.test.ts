import { describe, expect, it } from 'vitest';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { PendingVersion, SESSION_WINDOW_MS, shouldCoalesceAuthorEdit } from './coalesce';

describe('shouldCoalesceAuthorEdit', () => {
  const now = Date.now();

  // Helper to create a version
  const makeVersion = (
    id: string,
    creator: Entity.AUTHOR | Entity.SYSTEM,
    createdAt: number = now - 1000,
  ): Version => ({
    id: id as any,
    creator,
    createdAt,
    updatedAt: createdAt,
    snapshot: { script: [], guidebook: '' },
  });

  // Helper to create pending version
  const makePending = (
    versionId: string,
    creator: Entity.AUTHOR | Entity.SYSTEM,
    updatedAt: number = now - 1000,
  ): PendingVersion => ({
    versionId,
    creator,
    updatedAt,
  });

  describe('when latest version is AI', () => {
    it('should NOT coalesce - create new author version instead', () => {
      const aiVersion = makeVersion('ai-1', Entity.SYSTEM, now - 1000);
      const result = shouldCoalesceAuthorEdit(null, aiVersion, now);
      expect(result.action).toBe('create');
    });

    it('should NOT coalesce even if within time window', () => {
      const aiVersion = makeVersion('ai-1', Entity.SYSTEM, now - 100); // Very recent
      const result = shouldCoalesceAuthorEdit(null, aiVersion, now);
      expect(result.action).toBe('create');
    });

    it('should NOT coalesce with AI even if pending exists but was cleared', () => {
      // Scenario: user was editing, AI made a change, user continues editing
      // pending was cleared when AI edited, latestVersion is now AI
      const aiVersion = makeVersion('ai-1', Entity.SYSTEM, now - 500);
      const result = shouldCoalesceAuthorEdit(null, aiVersion, now);
      expect(result.action).toBe('create');
    });
  });

  describe('when latest version is author', () => {
    it('should coalesce if within time window', () => {
      const authorVersion = makeVersion('author-1', Entity.AUTHOR, now - 1000);
      const result = shouldCoalesceAuthorEdit(null, authorVersion, now);
      expect(result.action).toBe('coalesce');
      expect(result.versionIdToUpdate).toBe('author-1');
    });

    it('should NOT coalesce if outside time window', () => {
      const oldVersion = makeVersion('author-1', Entity.AUTHOR, now - SESSION_WINDOW_MS - 1000);
      const result = shouldCoalesceAuthorEdit(null, oldVersion, now);
      expect(result.action).toBe('create');
    });
  });

  describe('with pending version', () => {
    it('should use pending version for coalescing if author and recent', () => {
      const pending = makePending('pending-1', Entity.AUTHOR, now - 500);
      const latestVersion = makeVersion('author-1', Entity.AUTHOR, now - 2000);
      const result = shouldCoalesceAuthorEdit(pending, latestVersion, now);
      expect(result.action).toBe('coalesce');
      expect(result.versionIdToUpdate).toBe('pending-1'); // Uses pending, not latest
    });

    it('should NOT coalesce with pending if pending is AI (should never happen but edge case)', () => {
      const pending = makePending('pending-1', Entity.SYSTEM, now - 500);
      const aiVersion = makeVersion('ai-1', Entity.SYSTEM, now - 1000);
      const result = shouldCoalesceAuthorEdit(pending, aiVersion, now);
      expect(result.action).toBe('create');
    });

    it('should fall back to latestVersion if pending is expired', () => {
      const oldPending = makePending('pending-1', Entity.AUTHOR, now - SESSION_WINDOW_MS - 1000);
      const recentAuthor = makeVersion('author-2', Entity.AUTHOR, now - 500);
      const result = shouldCoalesceAuthorEdit(oldPending, recentAuthor, now);
      expect(result.action).toBe('coalesce');
      expect(result.versionIdToUpdate).toBe('author-2'); // Falls back to latest
    });
  });

  describe('edge cases', () => {
    it('should create new version if no versions exist', () => {
      const result = shouldCoalesceAuthorEdit(null, null, now);
      expect(result.action).toBe('create');
    });

    it('should handle stale latestVersion correctly after AI edit', () => {
      // This is the bug scenario:
      // 1. Author makes edit, pendingRef set
      // 2. AI makes edit, pendingRef cleared
      // 3. Author makes another edit
      // 4. latestVersion in closure might still be old author version
      //
      // The fix: if pending is null and latestVersion is author,
      // we can coalesce with latestVersion (this is correct behavior)
      // But if latestVersion is actually AI (not stale), we should NOT coalesce
      const aiVersion = makeVersion('ai-1', Entity.SYSTEM, now - 100);
      const result = shouldCoalesceAuthorEdit(null, aiVersion, now);
      expect(result.action).toBe('create');
    });
  });
});
