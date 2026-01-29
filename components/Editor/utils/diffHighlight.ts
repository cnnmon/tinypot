/**
 * CodeMirror plugin for highlighting diff between adjacent versions.
 *
 * When viewing a version, we compare "before" (previous version) to "after" (selected version):
 * - Red: Lines that were in "before" but NOT in "after" (removed in this version)
 * - Green: Lines that are in "after" but NOT in "before" (added in this version)
 *
 * We show the "after" version in the editor, so:
 * - Red = this line was removed (only shown via count widget)
 * - Green = this line was added in this version
 */

import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';

export interface DiffState {
  versionScript: string[] | null;
  currentScript: string[];
}

// State effect to update diff state
export const setDiffHighlight = StateEffect.define<DiffState>();

// State field to hold diff state
export const diffHighlightState = StateField.define<DiffState>({
  create() {
    return { versionScript: null, currentScript: [] };
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setDiffHighlight)) {
        return e.value;
      }
    }
    return value;
  },
});

/** Normalize a line for comparison (trim whitespace, lowercase) */
function normalizeLine(line: string): string {
  return line.trim().toLowerCase();
}

/** Build a set of normalized lines for quick lookup */
function buildLineSet(lines: string[]): Set<string> {
  const set = new Set<string>();
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

/** Widget to show removed lines count */
class RemovedLinesWidget extends WidgetType {
  constructor(readonly count: number) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-diff-removed-widget';
    span.textContent = `-${this.count} line${this.count > 1 ? 's' : ''} removed`;
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

/** Build decorations for diff highlighting */
function buildDiffDecorations(view: EditorView): DecorationSet {
  const state = view.state.field(diffHighlightState);
  // versionScript = "after" (the selected version we're viewing)
  // currentScript = "before" (the previous version to compare against)
  const { versionScript: afterScript, currentScript: beforeScript } = state;

  // No diff if no after script
  if (!afterScript || afterScript.length === 0) {
    return Decoration.none;
  }

  // Build line sets for comparison
  const beforeSet = buildLineSet(beforeScript);
  const afterSet = buildLineSet(afterScript);

  const decorations: { from: number; deco: Decoration }[] = [];
  const doc = view.state.doc;

  // Count removals (lines in "before" but not in "after")
  let removedCount = 0;
  for (const normalized of beforeSet) {
    if (!afterSet.has(normalized)) {
      removedCount++;
    }
  }

  // Process each line in the displayed document (which shows "after")
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const normalized = normalizeLine(line.text);

    if (!normalized) continue; // Skip empty lines

    const inBefore = beforeSet.has(normalized);
    const inAfter = afterSet.has(normalized);

    let lineClass = '';

    if (inAfter && !inBefore) {
      // Line exists in "after" but not in "before" = ADDED in this version (green)
      lineClass = 'cm-diff-added';
    }
    // Lines in both = unchanged, no highlight

    if (lineClass) {
      decorations.push({
        from: line.from,
        deco: Decoration.line({ class: lineClass }),
      });
    }
  }

  // Add widget at top to show removals count (lines that were removed in this version)
  if (removedCount > 0 && doc.lines > 0) {
    const firstLine = doc.line(1);
    decorations.push({
      from: firstLine.from,
      deco: Decoration.widget({
        widget: new RemovedLinesWidget(removedCount),
        side: -1,
      }),
    });
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from).map((d) => d.deco.range(d.from)));
}

// View plugin for diff highlighting
export const diffHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDiffDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setDiffHighlight)))
      ) {
        this.decorations = buildDiffDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// CSS for diff highlighting
export const diffHighlightTheme = EditorView.theme({
  // Red - removed since this version (line is in version but not in current)
  '.cm-diff-removed': {
    backgroundColor: '#FEE2E2', // red-100
    borderLeft: '3px solid #EF4444', // red-500
    textDecoration: 'line-through',
    opacity: 0.7,
  },
  // Green - added since this version
  '.cm-diff-added': {
    backgroundColor: '#DCFCE7', // green-100
    borderLeft: '3px solid #22C55E', // green-500
  },
  // Widget showing removed lines count
  '.cm-diff-removed-widget': {
    display: 'block',
    padding: '4px 8px',
    marginBottom: '4px',
    backgroundColor: '#FEE2E2',
    borderLeft: '3px solid #EF4444',
    color: '#991B1B',
    fontSize: '12px',
    fontStyle: 'italic',
  },
});
