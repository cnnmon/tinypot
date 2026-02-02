/**
 * Version coalescing logic - extracted for testing.
 */

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

// Session window for coalescing author versions (1 hour)
export const SESSION_WINDOW_MS = 60 * 60 * 1000;

export interface PendingVersion {
  versionId: string;
  creator: Entity.AUTHOR | Entity.SYSTEM;
  updatedAt: number;
}

export interface CoalesceDecision {
  action: 'coalesce' | 'create';
  /** Version ID to update (only if action === 'coalesce') */
  versionIdToUpdate?: string;
}

/**
 * Decide whether to coalesce an author edit with an existing version.
 *
 * Rules:
 * 1. ONLY coalesce with an existing AUTHOR version
 * 2. NEVER coalesce if the latest version is from AI (even if pending exists)
 * 3. Must be within the session time window
 * 4. Prefer pending version over latestVersion for coalescing
 */
export function shouldCoalesceAuthorEdit(
  pending: PendingVersion | null,
  latestVersion: Version | null,
  now: number,
): CoalesceDecision {
  // If we have a pending author version and it's within the time window, coalesce with it
  if (pending && pending.creator === Entity.AUTHOR) {
    const timeSinceUpdate = now - pending.updatedAt;
    if (timeSinceUpdate < SESSION_WINDOW_MS) {
      return { action: 'coalesce', versionIdToUpdate: pending.versionId };
    }
  }

  // If pending is null or expired, check latestVersion
  // BUT: only coalesce if latestVersion is AUTHOR (never coalesce with AI version)
  if (latestVersion && latestVersion.creator === Entity.AUTHOR) {
    const lastUpdated = latestVersion.updatedAt ?? latestVersion.createdAt;
    const timeSinceUpdate = now - lastUpdated;
    if (timeSinceUpdate < SESSION_WINDOW_MS) {
      return { action: 'coalesce', versionIdToUpdate: latestVersion.id };
    }
  }

  // Don't coalesce - create a new version
  return { action: 'create' };
}
