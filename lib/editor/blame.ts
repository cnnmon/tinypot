/**
 * Git-blame style line attribution.
 * Computes which entity (AUTHOR or SYSTEM) last edited each line
 * by diffing consecutive versions.
 */

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

export type LineBlame = Entity.AUTHOR | Entity.SYSTEM | null;

/**
 * Compute blame for each line in the current script.
 * Uses a simplified diff: compares line-by-line from versions (newest first).
 * Returns an array where each index corresponds to a line in currentScript.
 */
export function computeBlame(currentScript: string[], versions: Version[]): LineBlame[] {
  if (versions.length === 0) {
    // No versions = all lines are untracked (null)
    return currentScript.map(() => null);
  }

  const blame: LineBlame[] = new Array(currentScript.length).fill(null);
  const attributed = new Set<number>();

  // Walk through versions from newest to oldest
  // For each line in current script, find when it first appeared
  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];
    const versionScript = version.snapshot.script;
    const prevScript = versions[vIdx + 1]?.snapshot.script ?? [];

    // Find lines that exist in this version but not in previous
    // These are lines added/modified in this version
    for (let lineIdx = 0; lineIdx < currentScript.length; lineIdx++) {
      if (attributed.has(lineIdx)) continue;

      const currentLine = currentScript[lineIdx];
      const versionLine = versionScript[lineIdx];
      const prevLine = prevScript[lineIdx];

      // If current line matches this version's line
      if (currentLine === versionLine) {
        // And differs from previous version's line (or previous doesn't exist)
        if (versionLine !== prevLine) {
          blame[lineIdx] = version.creator;
          attributed.add(lineIdx);
        }
      }
    }
  }

  // For lines that weren't attributed through version history,
  // attribute to the oldest version's creator
  if (versions.length > 0) {
    const oldestVersion = versions[versions.length - 1];
    for (let lineIdx = 0; lineIdx < currentScript.length; lineIdx++) {
      if (!attributed.has(lineIdx)) {
        // Check if line exists in oldest version
        if (currentScript[lineIdx] === oldestVersion.snapshot.script[lineIdx]) {
          blame[lineIdx] = oldestVersion.creator;
        }
      }
    }
  }

  return blame;
}
