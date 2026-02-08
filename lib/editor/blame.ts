/**
 * Git-blame style line attribution.
 * Computes which entity (AUTHOR or SYSTEM) last edited each line
 * by diffing consecutive versions using LCS for proper tracking.
 */

import { computeLcsMapping, findAddedIndices, normalizeLine } from '@/lib/diff';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

export type LineBlame = Entity.AUTHOR | Entity.SYSTEM | null;

/**
 * Compute blame for each line in the current script.
 * Uses LCS-based positional mapping to properly track which lines were added by whom.
 *
 * @param onlyUnresolved - If true, only blame unresolved AI versions (for highlighting)
 */
export function computeBlame(currentScript: string[], versions: Version[], onlyUnresolved = false): LineBlame[] {
  if (versions.length === 0) {
    return currentScript.map(() => null);
  }

  const blame: LineBlame[] = new Array(currentScript.length).fill(null);
  const attributed = new Set<number>();

  // Debug: log versions being processed
  if (process.env.NODE_ENV === 'development') {
    const unresolvedAi = versions.filter((v) => v.creator === Entity.SYSTEM && !v.resolved);
    if (unresolvedAi.length > 0 && onlyUnresolved) {
      console.log('[Blame] Processing', versions.length, 'versions,', unresolvedAi.length, 'unresolved AI');
    }
  }

  // For each version (newest to oldest)
  for (let vIdx = 0; vIdx < versions.length; vIdx++) {
    const version = versions[vIdx];

    // Skip resolved AI versions if we only want unresolved highlights
    if (onlyUnresolved && version.creator === Entity.SYSTEM && version.resolved) {
      continue;
    }

    const versionScript = version.snapshot.script;
    const prevScript = versions[vIdx + 1]?.snapshot.script ?? [];

    // Find which lines in versionScript are additions (compared to previous version)
    const addedInVersion = findAddedIndices(prevScript, versionScript);

    // Debug: log what's being attributed
    if (process.env.NODE_ENV === 'development' && version.creator === Entity.SYSTEM && !version.resolved && addedInVersion.size > 0) {
      console.log('[Blame] AI version added', addedInVersion.size, 'lines:');
      for (const idx of addedInVersion) {
        console.log('  ', idx, ':', versionScript[idx]?.substring(0, 50));
      }
    }

    // Map current script lines to version script lines
    const currentToVersion = computeLcsMapping(currentScript, versionScript);

    // Blame current lines that map to added positions in this version
    for (let lineIdx = 0; lineIdx < currentScript.length; lineIdx++) {
      if (attributed.has(lineIdx)) continue;
      if (!normalizeLine(currentScript[lineIdx])) continue;

      const versionIdx = currentToVersion.get(lineIdx);
      if (versionIdx !== undefined && addedInVersion.has(versionIdx)) {
        blame[lineIdx] = version.creator;
        attributed.add(lineIdx);
      }
    }
  }

  return blame;
}
