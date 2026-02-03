/**
 * CodeMirror plugin for highlighting lines based on who edited them (blame).
 * - Yellow: AI-edited lines (not yet reviewed by author)
 * - Green: AI-edited lines that author has modified (reviewed)
 */

import { Entity } from '@/types/entities';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

type LineBlame = Entity.AUTHOR | Entity.SYSTEM | null;

export interface BlameState {
  blame: LineBlame[];
  /** Line indices that were AI but have been edited by author (reviewed) */
  reviewedLines: Set<number>;
  /** Whether to show any highlighting at all */
  showHighlighting: boolean;
}

// State effect to update blame data
export const setBlameHighlight = StateEffect.define<{
  blame: LineBlame[];
  reviewedLines?: Set<number>;
  showHighlighting?: boolean;
}>();

// State effect to mark a line as reviewed
export const markLineReviewed = StateEffect.define<number>();

// State effect to clear all highlighting
export const clearBlameHighlight = StateEffect.define<void>();

// State field to hold blame data
export const blameHighlightState = StateField.define<BlameState>({
  create() {
    return { blame: [], reviewedLines: new Set(), showHighlighting: true };
  },
  update(value, tr) {
    let newValue = value;

    for (const e of tr.effects) {
      if (e.is(setBlameHighlight)) {
        newValue = {
          blame: e.value.blame,
          reviewedLines: e.value.reviewedLines ?? value.reviewedLines,
          showHighlighting: e.value.showHighlighting ?? value.showHighlighting,
        };
      }
      if (e.is(markLineReviewed)) {
        const newReviewed = new Set(newValue.reviewedLines);
        newReviewed.add(e.value);
        newValue = { ...newValue, reviewedLines: newReviewed };
      }
      if (e.is(clearBlameHighlight)) {
        newValue = { ...newValue, showHighlighting: false };
      }
    }

    return newValue;
  },
});

// Build decorations for blame highlighting
function buildBlameDecorations(view: EditorView): DecorationSet {
  const state = view.state.field(blameHighlightState);
  const { blame, reviewedLines, showHighlighting } = state;

  if (!showHighlighting || blame.length === 0) {
    return Decoration.none;
  }

  const decorations: { from: number; deco: Decoration }[] = [];
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const lineIdx = i - 1; // blame is 0-indexed
    const line = doc.line(i);
    const lineBlame = blame[lineIdx];

    if (lineBlame === Entity.SYSTEM) {
      const isReviewed = reviewedLines.has(lineIdx);
      decorations.push({
        from: line.from,
        deco: Decoration.line({ class: isReviewed ? 'cm-blame-reviewed' : 'cm-blame-ai' }),
      });
    }
  }

  return Decoration.set(decorations.map((d) => d.deco.range(d.from)));
}

// View plugin for blame highlighting
export const blameHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildBlameDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild decorations when document changes or blame state changes
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setBlameHighlight)))
      ) {
        this.decorations = buildBlameDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// CSS for blame highlighting
export const blameHighlightTheme = EditorView.theme({
  '.cm-blame-ai': {
    backgroundColor: '#FEF9C3', // yellow-100 - AI wrote, not yet reviewed
  },
  '.cm-blame-reviewed': {
    backgroundColor: '#DCFCE7', // green-100 - AI wrote, author reviewed/edited
  },
});
