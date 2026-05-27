/**
 * Git-blame style line attribution.
 *
 * Thin adapter around `lib/attribution.replayVersions` that maps the
 * attribution model's `Source` ('ai' | 'human' | 'base') back to the editor's
 * `LineBlame` type (`Entity.SYSTEM` | `Entity.AUTHOR` | null).
 *
 * The diff logic itself lives in `lib/attribution` and is shared with the
 * `/sandbox` playground and the live editor's CodeMirror highlight plugin.
 */

import { replayVersions, Source } from '@/lib/attribution';
import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

export type LineBlame = Entity.AUTHOR | Entity.SYSTEM | null;

const sourceToBlame: Record<Source, LineBlame> = {
  ai: Entity.SYSTEM,
  human: Entity.AUTHOR,
  base: null,
};

/**
 * Compute blame for each line in `currentScript`.
 * @param onlyUnresolved when true, AI versions with `resolved=true` are folded
 *   into the base state (no SYSTEM highlight), matching the editor's
 *   "highlights dismissed -> content acknowledged" semantic.
 */
export function computeBlame(currentScript: string[], versions: Version[], onlyUnresolved = false): LineBlame[] {
  const doc = replayVersions(versions, currentScript, { treatResolvedAsBase: onlyUnresolved });
  return doc.source.map((s) => sourceToBlame[s]);
}
