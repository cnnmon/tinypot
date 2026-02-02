/**
 * CodeMirror plugin for highlighting lines based on who edited them (blame).
 * AI-edited lines are highlighted in yellow.
 */

import { Entity } from '@/types/entities';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

type LineBlame = Entity.AUTHOR | Entity.SYSTEM | null;

// State effect to update blame data
export const setBlameHighlight = StateEffect.define<LineBlame[]>();

// State field to hold blame data
export const blameHighlightState = StateField.define<LineBlame[]>({
  create() {
    return [];
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setBlameHighlight)) {
        return e.value;
      }
    }
    return value;
  },
});

// Build decorations for blame highlighting
function buildBlameDecorations(view: EditorView): DecorationSet {
  const blame = view.state.field(blameHighlightState);

  if (blame.length === 0) {
    return Decoration.none;
  }

  const decorations: { from: number; deco: Decoration }[] = [];
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const lineBlame = blame[i - 1]; // blame is 0-indexed

    if (lineBlame === Entity.SYSTEM) {
      decorations.push({
        from: line.from,
        deco: Decoration.line({ class: 'cm-blame-ai' }),
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
    backgroundColor: '#FEF9C3', // yellow-100
  },
});
