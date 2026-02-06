/**
 * CodeMirror plugin for GitHub-style diff highlighting between versions.
 *
 * Compares "before" (previous version) to "after" (selected version):
 * - Red lines: Were in "before" but removed in "after" (shown as inline widgets)
 * - Green lines: Added in "after" that weren't in "before"
 */

import { computeLcsMapping, findAddedIndices } from '@/lib/diff';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';

export interface DiffState {
  versionScript: string[] | null;
  currentScript: string[];
}

/** Find removed lines with their positions relative to the "after" document */
function findRemovedLinesWithPositions(
  before: string[],
  after: string[],
): { afterLineIdx: number; lines: string[] }[] {
  const mapping = computeLcsMapping(before, after);
  const matchedBeforeIndices = new Set(mapping.keys());

  // Group consecutive removed lines and track where they should appear
  const result: { afterLineIdx: number; lines: string[] }[] = [];
  let currentGroup: string[] = [];
  let insertAfterLine = -1; // -1 means before line 0

  for (let i = 0; i < before.length; i++) {
    if (matchedBeforeIndices.has(i)) {
      // This line is matched - flush any accumulated removed lines
      if (currentGroup.length > 0) {
        result.push({ afterLineIdx: insertAfterLine, lines: [...currentGroup] });
        currentGroup = [];
      }
      // Update insertion point to after the corresponding "after" line
      insertAfterLine = mapping.get(i)!;
    } else {
      // This line was removed
      currentGroup.push(before[i]);
    }
  }

  // Flush remaining removed lines
  if (currentGroup.length > 0) {
    result.push({ afterLineIdx: insertAfterLine, lines: [...currentGroup] });
  }

  return result;
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

/** Widget to show actual removed lines (GitHub-style) */
class RemovedLinesWidget extends WidgetType {
  constructor(readonly lines: string[]) {
    super();
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-diff-removed-block';

    for (const line of this.lines) {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'cm-diff-removed-line';

      const marker = document.createElement('span');
      marker.className = 'cm-diff-removed-marker';
      marker.textContent = '−';

      const content = document.createElement('span');
      content.className = 'cm-diff-removed-content';
      content.textContent = line || ' '; // Show space for empty lines

      lineDiv.appendChild(marker);
      lineDiv.appendChild(content);
      container.appendChild(lineDiv);
    }

    return container;
  }

  ignoreEvent() {
    return true;
  }

  eq(other: RemovedLinesWidget) {
    return this.lines.length === other.lines.length && this.lines.every((l, i) => l === other.lines[i]);
  }
}

/** Build decorations for diff highlighting */
function buildDiffDecorations(state: EditorState): DecorationSet {
  const diffState = state.field(diffHighlightState);
  // versionScript = "after" (the selected version we're viewing)
  // currentScript = "before" (the previous version to compare against)
  const { versionScript: afterScript, currentScript: beforeScript } = diffState;

  // No diff if no after script
  if (!afterScript || afterScript.length === 0) {
    return Decoration.none;
  }

  // Use LCS-based positional diff to find added lines
  const addedIndices = findAddedIndices(beforeScript, afterScript);

  // Track decorations with position and side for proper sorting
  const decorations: { from: number; side: number; deco: Decoration }[] = [];
  const doc = state.doc;

  // Find removed lines with their insertion positions
  const removedGroups = findRemovedLinesWithPositions(beforeScript, afterScript);

  // Process each line in the displayed document (which shows "after")
  for (let i = 1; i <= doc.lines; i++) {
    const lineIdx = i - 1; // 0-indexed for our addedIndices

    if (addedIndices.has(lineIdx)) {
      decorations.push({
        from: doc.line(i).from,
        side: -2, // Line decorations come before widgets at same position
        deco: Decoration.line({ class: 'cm-diff-added' }),
      });
    }
  }

  // Add widgets to show removed lines at their correct positions
  for (const group of removedGroups) {
    // afterLineIdx is the 0-indexed line in "after" that removed lines come after
    // -1 means they come before line 0
    let insertPos: number;
    const side = group.afterLineIdx < 0 ? -1 : 1;
    if (group.afterLineIdx < 0) {
      // Insert before the first line
      insertPos = 0;
    } else if (group.afterLineIdx >= doc.lines) {
      // Insert at end of document
      insertPos = doc.length;
    } else {
      // Insert at the end of the referenced line
      insertPos = doc.line(group.afterLineIdx + 1).to;
    }

    decorations.push({
      from: insertPos,
      side,
      deco: Decoration.widget({
        widget: new RemovedLinesWidget(group.lines),
        side,
        block: true,
      }),
    });
  }

  // Let CodeMirror handle the sorting (pass true as second arg)
  return Decoration.set(
    decorations.map((d) => d.deco.range(d.from)),
    true // Enable automatic sorting
  );
}

// StateField for diff decorations (required for block widgets)
export const diffHighlightPlugin = StateField.define<DecorationSet>({
  create(state) {
    return buildDiffDecorations(state);
  },
  update(decorations, tr) {
    // Rebuild if diff state changed or document changed
    if (tr.docChanged || tr.effects.some((e) => e.is(setDiffHighlight))) {
      return buildDiffDecorations(tr.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// CSS for diff highlighting (GitHub-style)
export const diffHighlightTheme = EditorView.theme({
  // Green - added lines
  '.cm-diff-added': {
    backgroundColor: '#dafbe1', // GitHub green bg
    borderLeft: '4px solid #2da44e',
  },
  // Container for removed lines block
  '.cm-diff-removed-block': {
    display: 'block',
    width: '100%',
  },
  // Individual removed line (GitHub-style)
  '.cm-diff-removed-line': {
    display: 'flex',
    backgroundColor: '#ffebe9', // GitHub red bg
    borderLeft: '4px solid #cf222e',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    minHeight: '1.4em',
  },
  // Minus marker
  '.cm-diff-removed-marker': {
    display: 'inline-block',
    width: '20px',
    textAlign: 'center',
    color: '#cf222e',
    fontWeight: 'bold',
    flexShrink: 0,
    userSelect: 'none',
  },
  // Removed line content
  '.cm-diff-removed-content': {
    flex: 1,
    color: '#82071e',
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});
