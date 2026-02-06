import { Version } from '@/types/version';
import { snapshotsEqual } from './snapshotsEqual';

// 1 hour session window for coalescing versions
const SESSION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Coalesce consecutive versions by the same creator within a session (1 hour),
 * and filter out versions with no content changes from the previous.
 * Returns a simplified list for display.
 */
export function coalesceVersions(versions: Version[], windowMs = SESSION_WINDOW_MS): Version[] {
  if (versions.length === 0) return [];

  // First pass: filter out versions with identical content to previous
  const dedupedVersions: Version[] = [versions[0]];
  for (let i = 1; i < versions.length; i++) {
    const prev = dedupedVersions[dedupedVersions.length - 1];
    const curr = versions[i];
    // Keep if content differs from previous kept version
    if (!snapshotsEqual(prev.snapshot, curr.snapshot)) {
      dedupedVersions.push(curr);
    }
  }

  if (dedupedVersions.length === 0) return [];

  // Second pass: coalesce by creator and time window
  const result: Version[] = [];
  let current = dedupedVersions[0];

  for (let i = 1; i < dedupedVersions.length; i++) {
    const v = dedupedVersions[i];
    const timeDiff = current.createdAt - v.createdAt;

    // Coalesce if same creator and within time window
    if (v.creator === current.creator && timeDiff < windowMs) {
      continue;
    }

    result.push(current);
    current = v;
  }

  result.push(current);
  return result;
}
