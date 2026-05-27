/**
 * Line-level attribution: which "source" (base / AI / human) last touched
 * each line of a markup script. Used by the editor highlights and by the
 * cultivation loop's "what did the human change?" signal.
 *
 * Model
 * -----
 * The doc is `lines + source[]`. On every edit we replace the doc with a new
 * line array attributed to a `Source`. Lines that match the prior tick
 * *exactly* (by string equality, in order) keep their old source; lines
 * that are new or changed take the editor's source.
 *
 * Why exact-match LCS:
 * - Backspacing one char in an AI line -> content differs -> downgrades to human
 * - Deleting an AI line whole -> line disappears, no ghost attribution
 * - Joining lines (backspace at line start) -> merged line is new -> human
 * - Re-typing the same AI text later -> at each tick the line differs from the
 *   immediately prior tick, so it stays human. We diff tick-to-tick, not vs
 *   the original AI snapshot.
 *
 * This same `applyEdit` chain is used in two places:
 * 1. The live editor (`/sandbox` + production Editor): each CodeMirror
 *    transaction is one tick; source is updated in the same transaction.
 * 2. `replayVersions`: walk persisted version history oldest -> newest,
 *    feeding each snapshot through `applyEdit` with its creator as the editor.
 */

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

export type Source = 'ai' | 'human' | 'base';

export interface AttributedDoc {
  lines: string[];
  source: Source[];
}

export function makeDoc(lines: string[], src: Source = 'base'): AttributedDoc {
  return { lines: [...lines], source: lines.map(() => src) };
}

/**
 * Exact-match LCS mapping from `before` -> `after`. Returns Map<beforeIdx, afterIdx>.
 *
 * Picks the EARLIEST valid match for each `before` line among optimal LCS paths.
 * Uses forward + backward DP so the chosen match is guaranteed to be part of an
 * optimal alignment (no missed matches when duplicates / trailing edits occur).
 */
export function lineLcs(before: string[], after: string[]): Map<number, number> {
  const m = before.length;
  const n = after.length;
  if (m === 0 || n === 0) return new Map();

  // dp[i][j] = LCS of before[0..i-1], after[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = before[i - 1] === after[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // bp[i][j] = LCS of before[i..m-1], after[j..n-1] (suffix)
  const bp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      bp[i][j] = before[i] === after[j] ? bp[i + 1][j + 1] + 1 : Math.max(bp[i + 1][j], bp[i][j + 1]);
    }
  }

  const total = dp[m][n];
  const mapping = new Map<number, number>();
  let minJ = 0;
  for (let i = 0; i < m; i++) {
    for (let j = minJ; j < n; j++) {
      if (before[i] === after[j] && dp[i][j] + 1 + bp[i + 1][j + 1] === total) {
        mapping.set(i, j);
        minJ = j + 1;
        break;
      }
    }
  }
  return mapping;
}

/**
 * Replace `doc` with `newLines`, attributing changed/added lines to `editor`.
 * Unchanged lines keep their source. Editor can be any `Source` (use 'base'
 * to fold in resolved/acknowledged content without highlighting it).
 */
export function applyEdit(doc: AttributedDoc, newLines: string[], editor: Source): AttributedDoc {
  const mapping = lineLcs(doc.lines, newLines);
  const afterToBefore = new Map<number, number>();
  for (const [b, a] of mapping) afterToBefore.set(a, b);

  const source: Source[] = newLines.map((_, i) => {
    const beforeIdx = afterToBefore.get(i);
    return beforeIdx !== undefined ? doc.source[beforeIdx] : editor;
  });

  return { lines: [...newLines], source };
}

/** Convenience: apply a human edit (typical user typing in the editor). */
export function applyHumanEdit(doc: AttributedDoc, newLines: string[]): AttributedDoc {
  return applyEdit(doc, newLines, 'human');
}

/**
 * Convenience: splice an AI-generated branch into the doc at `afterLineIdx`
 * (insertion point is *after* that line; use -1 to prepend).
 */
export function insertAiBranch(doc: AttributedDoc, afterLineIdx: number, branchLines: string[]): AttributedDoc {
  const at = Math.max(-1, Math.min(afterLineIdx, doc.lines.length - 1)) + 1;
  const newLines = [...doc.lines.slice(0, at), ...branchLines, ...doc.lines.slice(at)];
  return applyEdit(doc, newLines, 'ai');
}

export interface ReplayOptions {
  /**
   * If true, AI versions with `resolved=true` are replayed as `base` instead
   * of `ai`. This matches the editor's "after the author dismissed the
   * highlights, the AI content is now acknowledged" semantic.
   */
  treatResolvedAsBase?: boolean;
}

/**
 * Replay persisted version history (newest-first, as stored in Convex) and
 * return the attributed doc for `currentScript`.
 *
 * - With no versions, every line of `currentScript` is `base`.
 * - Versions are walked oldest -> newest through `applyEdit`, using each
 *   version's creator as the editor (AUTHOR -> 'human', SYSTEM -> 'ai').
 * - If `currentScript` differs from the latest version's snapshot, it's
 *   applied as a final 'human' tick (in-progress edits that haven't been
 *   versioned yet).
 */
export function replayVersions(
  versions: Version[],
  currentScript: string[],
  options: ReplayOptions = {},
): AttributedDoc {
  if (versions.length === 0) return makeDoc(currentScript, 'base');

  // Versions are stored newest-first; replay oldest-first.
  const ordered = [...versions].reverse();
  let doc = makeDoc([], 'base');
  for (const v of ordered) {
    const editor: Source =
      v.creator === Entity.SYSTEM ? (options.treatResolvedAsBase && v.resolved ? 'base' : 'ai') : 'human';
    doc = applyEdit(doc, v.snapshot.script, editor);
  }

  // Fold in any unversioned edits (the working state often runs ahead of the
  // most recent committed version by a few keystrokes).
  if (!linesEqual(doc.lines, currentScript)) {
    doc = applyEdit(doc, currentScript, 'human');
  }

  return doc;
}

function linesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
