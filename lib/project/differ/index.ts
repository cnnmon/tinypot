export type DiffType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface LineDiff {
  lineNumber: number;
  type: DiffType;
  content: string;
  originalContent?: string; // For modified lines, the original text
}

/**
 * Computes line-by-line diff between base and current lines.
 * Returns diff info for each line in the current version.
 */
export function diffLines(baseLines: string[], currentLines: string[]): LineDiff[] {
  const result: LineDiff[] = [];
  for (let i = 0; i < currentLines.length; i++) {
    const currentLine = currentLines[i];
    const baseLine = baseLines[i];

    if (i >= baseLines.length) {
      // Line was added (beyond original length)
      result.push({ lineNumber: i, type: 'added', content: currentLine });
    } else if (currentLine === baseLine) {
      // Unchanged
      result.push({ lineNumber: i, type: 'unchanged', content: currentLine });
    } else {
      // Modified
      result.push({
        lineNumber: i,
        type: 'modified',
        content: currentLine,
        originalContent: baseLine,
      });
    }
  }

  return result;
}

/**
 * Returns just the line numbers that have changes.
 */
export function getChangedLineNumbers(baseLines: string[], currentLines: string[]): Set<number> {
  const diffs = diffLines(baseLines, currentLines);
  return new Set(diffs.filter((d) => d.type !== 'unchanged').map((d) => d.lineNumber));
}

/**
 * Checks if there are any differences between two line arrays.
 */
export function hasChanges(baseLines: string[], currentLines: string[]): boolean {
  if (baseLines.length !== currentLines.length) return true;
  return baseLines.some((line, i) => line !== currentLines[i]);
}
