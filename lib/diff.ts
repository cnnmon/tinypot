/**
 * LCS-based diff utilities for line-by-line comparison.
 * Used by both blame highlighting and diff highlighting.
 */

/** Normalize line for comparison (trim whitespace, lowercase) */
export function normalizeLine(line: string): string {
  return line.trim().toLowerCase();
}

/**
 * Compute LCS table for two arrays of normalized lines.
 */
function buildLcsTable(source: string[], target: string[]): number[][] {
  const m = source.length;
  const n = target.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (source[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Compute LCS and return position mapping from source to target.
 * Uses forward tracking to prefer matching earlier indices when there are duplicates.
 * Returns Map<sourceIndex, targetIndex> for matched lines.
 */
export function computeLcsMapping(source: string[], target: string[]): Map<number, number> {
  const sourceNorm = source.map(normalizeLine);
  const targetNorm = target.map(normalizeLine);

  const m = sourceNorm.length;
  const n = targetNorm.length;

  const dp = buildLcsTable(sourceNorm, targetNorm);

  // Forward tracking to prefer earlier matches for duplicates
  const mapping = new Map<number, number>();
  let j = 0;
  for (let i = 0; i < m; i++) {
    while (j < n) {
      if (sourceNorm[i] === targetNorm[j]) {
        // Check if this match is part of an optimal LCS path
        const remaining = dp[m][n] - dp[i + 1][j + 1];
        if (dp[i][j] + 1 + remaining >= dp[m][n]) {
          mapping.set(i, j);
          j++;
          break;
        }
      }
      j++;
    }
  }

  return mapping;
}

/**
 * Find which indices in `after` are additions (not matched from `before`).
 */
export function findAddedIndices(before: string[], after: string[]): Set<number> {
  const mapping = computeLcsMapping(before, after);
  const matchedAfterIndices = new Set(mapping.values());

  const added = new Set<number>();
  for (let i = 0; i < after.length; i++) {
    if (!matchedAfterIndices.has(i) && normalizeLine(after[i])) {
      added.add(i);
    }
  }
  return added;
}
