/**
 * Detects author feedback on AI-generated content by analyzing version diffs.
 * When AI adds content and the author subsequently modifies it, this indicates
 * implicit feedback that should be recorded in the guidebook.
 */

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';

export type FeedbackType = 'REMOVE' | 'EDIT' | null;

/**
 * Find lines that were added in a version by comparing to the previous version.
 * Returns indices of lines that are new in `after` compared to `before`.
 */
function findAddedLines(before: string[], after: string[]): Set<number> {
  const beforeSet = new Set(before.map((l) => l.trim()));
  const added = new Set<number>();

  for (let i = 0; i < after.length; i++) {
    if (!beforeSet.has(after[i].trim())) {
      added.add(i);
    }
  }
  return added;
}

/**
 * Find if statements (branches) in a script.
 * Returns array of { startIdx, endIdx, content } for each branch.
 */
interface BranchRange {
  startIdx: number;
  endIdx: number; // exclusive
  content: string[];
}

function findBranches(script: string[]): BranchRange[] {
  const branches: BranchRange[] = [];

  for (let i = 0; i < script.length; i++) {
    const trimmed = script[i].trim();
    if (!trimmed.startsWith('if ') || trimmed.match(/^if\s+\[/)) continue; // Skip conditionals like if [key]

    const branchStart = i;
    const branchIndent = script[i].match(/^(\s*)/)?.[1].length ?? 0;

    // Find end of branch (next line at same or lower indent)
    let j = i + 1;
    while (j < script.length) {
      const line = script[j];
      const lineTrimmed = line.trim();
      if (!lineTrimmed) {
        j++;
        continue;
      }
      const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (lineIndent <= branchIndent) break;
      j++;
    }

    branches.push({
      startIdx: branchStart,
      endIdx: j,
      content: script.slice(branchStart, j),
    });
    i = j - 1;
  }

  return branches;
}

/**
 * Check if a branch was added in a version (most of its lines are new).
 */
function wasBranchAdded(branch: BranchRange, addedLines: Set<number>): boolean {
  // If more than half the branch lines are "added", consider the branch as added
  let addedCount = 0;
  for (let i = branch.startIdx; i < branch.endIdx; i++) {
    if (addedLines.has(i)) addedCount++;
  }
  return addedCount > (branch.endIdx - branch.startIdx) / 2;
}

/**
 * Check if a branch exists in a script (by comparing the if statement text).
 */
function findMatchingBranch(branch: BranchRange, script: string[]): BranchRange | null {
  const branchIfLine = branch.content[0]?.trim();
  if (!branchIfLine) return null;

  const branches = findBranches(script);
  return branches.find((b) => b.content[0]?.trim() === branchIfLine) ?? null;
}

/**
 * Compare two branches to determine if one is an edit of the other.
 * Returns true if the content differs but the if statement is the same.
 */
function isBranchEdited(original: BranchRange, modified: BranchRange): boolean {
  if (original.content[0]?.trim() !== modified.content[0]?.trim()) return false;
  if (original.content.length !== modified.content.length) return true;
  return !original.content.every((line, i) => line === modified.content[i]);
}

/**
 * Extract the choice text from a branch (without the "if " prefix).
 */
function getBranchText(branch: BranchRange): string {
  return branch.content[0]?.trim().replace(/^if\s+/, '') ?? '';
}

/**
 * Detect if author feedback exists between an AI version and the subsequent author version.
 * Returns { type: 'REMOVE' | 'EDIT', branch: string } or null if no feedback detected.
 */
export function detectFeedback(
  aiVersion: Version,
  authorVersion: Version,
): { type: FeedbackType; branch: string } | null {
  if (aiVersion.creator !== Entity.SYSTEM || authorVersion.creator !== Entity.AUTHOR) {
    return null;
  }

  const aiScript = aiVersion.snapshot.script;
  const authorScript = authorVersion.snapshot.script;
  const prevScript: string[] = []; // AI version is compared to "empty" to find what it added

  // Find what the AI added
  const aiBranches = findBranches(aiScript);
  const addedByAI = findAddedLines(prevScript, aiScript);

  // Find branches that were added by AI
  const addedBranches = aiBranches.filter((b) => wasBranchAdded(b, addedByAI));

  if (addedBranches.length === 0) return null;

  // Check each AI-added branch against the author's version
  for (const aiBranch of addedBranches) {
    const authorBranch = findMatchingBranch(aiBranch, authorScript);
    const branchText = getBranchText(aiBranch);

    if (!authorBranch) {
      return { type: 'REMOVE', branch: branchText };
    }

    if (isBranchEdited(aiBranch, authorBranch)) {
      return { type: 'EDIT', branch: branchText };
    }
  }

  return null;
}

/**
 * Analyze version history to detect AI→Author feedback patterns.
 * Returns feedback if the pattern is detected between the two most recent versions.
 */
export function detectFeedbackFromVersions(versions: Version[]): {
  type: FeedbackType;
  branch: string;
  aiVersionId: string;
  authorVersionId: string;
} | null {
  if (versions.length < 2) return null;

  // Versions are sorted newest first
  const newest = versions[0];
  const previous = versions[1];

  // Check if pattern: AI version followed by Author version
  if (previous.creator === Entity.SYSTEM && newest.creator === Entity.AUTHOR) {
    const feedback = detectFeedback(previous, newest);
    if (feedback && feedback.type) {
      return {
        type: feedback.type,
        branch: feedback.branch,
        aiVersionId: previous.id,
        authorVersionId: newest.id,
      };
    }
  }

  return null;
}

/**
 * Generate guidebook update text for detected feedback.
 */
export function formatGuidebookFeedback(type: FeedbackType, branch: string): string {
  if (type === 'REMOVE') {
    return `REMOVE: "${branch}"`;
  } else if (type === 'EDIT') {
    return `EDIT: "${branch}"`;
  }
  return '';
}
