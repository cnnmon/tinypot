/**
 * Git-blame style line attribution.
 * Computes which entity (AUTHOR or SYSTEM) last edited each line
 * by diffing consecutive versions using LCS for proper tracking.
 */

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

export type LineBlame = Entity.AUTHOR | Entity.SYSTEM | null;

/** Normalize line for comparison */
function normalizeLine(line: string): string {
  return line.trim().toLowerCase();
}

/**
 * Use LCS to find which lines in `after` are NEW (not in `before`).
 * Returns set of indices in `after` that are additions.
 */
function findAddedLineIndices(before: string[], after: string[]): Set<number> {
  const beforeNorm = before.map(normalizeLine);
  const afterNorm = after.map(normalizeLine);

  const m = beforeNorm.length;
  const n = afterNorm.length;
  
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeNorm[i - 1] === afterNorm[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matched indices in `after`
  const matchedAfterIndices = new Set<number>();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (beforeNorm[i - 1] === afterNorm[j - 1]) {
      matchedAfterIndices.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Lines not matched = added
  const addedIndices = new Set<number>();
  for (let idx = 0; idx < after.length; idx++) {
    if (!matchedAfterIndices.has(idx) && afterNorm[idx]) {
      addedIndices.add(idx);
    }
  }
  return addedIndices;
}

/**
 * Compute blame for each line in the current script.
 * Uses LCS-based diff to properly track insertions without wrongly blaming shifted lines.
 * 
 * @param onlyUnresolved - If true, only blame unresolved AI versions (for highlighting)
 */
export function computeBlame(currentScript: string[], versions: Version[], onlyUnresolved = false): LineBlame[] {
  if (versions.length === 0) {
    return currentScript.map(() => null);
  }

  const blame: LineBlame[] = new Array(currentScript.length).fill(null);
  const attributed = new Set<number>();

  // For each version (newest to oldest), find lines that were ADDED in that version
  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];
    
    // Skip resolved AI versions if we only want unresolved highlights
    if (onlyUnresolved && version.creator === Entity.SYSTEM && version.resolved) {
      continue;
    }
    
    const versionScript = version.snapshot.script;
    const prevScript = versions[vIdx + 1]?.snapshot.script ?? [];

    // Find which lines in versionScript are additions (not in prevScript)
    const addedInVersion = findAddedLineIndices(prevScript, versionScript);

    // For each line in current script that matches an added line in this version
    for (let lineIdx = 0; lineIdx < currentScript.length; lineIdx++) {
      if (attributed.has(lineIdx)) continue;

      const currentLine = normalizeLine(currentScript[lineIdx]);
      if (!currentLine) continue;

      // Check if this line content was added in this version
      for (const addedIdx of addedInVersion) {
        const addedLine = normalizeLine(versionScript[addedIdx]);
        if (currentLine === addedLine) {
          blame[lineIdx] = version.creator;
          attributed.add(lineIdx);
          break;
        }
      }
    }
  }

  return blame;
}
