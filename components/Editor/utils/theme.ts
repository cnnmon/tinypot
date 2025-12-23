import { HighlightStyle } from '@codemirror/language';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { tags } from '@lezer/highlight';

// Custom syntax highlighting for bonsai language
export const bonsaiHighlighting = HighlightStyle.define([
  { tag: tags.heading, color: '#7c3aed', fontWeight: 'bold' }, // # SCENE
  { tag: tags.link, color: '#0891b2' }, // > GOTO
  { tag: tags.list, color: '#059669' }, // ~ Option
  { tag: tags.string, color: '#6b7280' }, // indented content
]);

// Theme for the editor
export const bonsaiTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, monospace',
    lineHeight: '1.5',
    backgroundColor: '#f2f5e1',
  },
  '.cm-content': {
    padding: '16px 16px',
  },
  '.cm-gutters': {
    backgroundColor: '#DCECD2',
    borderRight: '1px solid #e5e5e5',
    color: '#a3a3a3',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
  },
  '.cm-activeLine': {
    backgroundColor: '#f5f5f5',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f5f5f5',
  },
  // Changed line highlighting
  '.cm-line-changed': {
    backgroundColor: '#fef9c3',
  },
  '.cm-gutterElement-changed': {
    backgroundColor: '#fef08a',
    color: '#854d0e',
    fontWeight: 'bold',
  },
});

// Additional theme for bonsai syntax
export const bonsaiSyntaxTheme = EditorView.theme({
  '.cm-bonsai-scene': {
    color: '#5187DF',
    fontWeight: 'bold',
  },
  '.cm-bonsai-goto': {
    color: '#EB6B7C',
  },
  '.cm-bonsai-option': {
    color: '#059669',
  },
  '.cm-bonsai-indent': {
    color: '#6b7280',
  },
});

// Custom highlighter that applies styles based on line content
function bonsaiLineHighlighter(view: EditorView) {
  const decorations: { from: number; to: number; deco: Decoration }[] = [];
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const trimmed = text.trimStart();

    let className = '';
    if (trimmed.startsWith('#')) {
      className = 'cm-bonsai-scene';
    } else if (trimmed.startsWith('>')) {
      className = 'cm-bonsai-goto';
    } else if (trimmed.startsWith('~')) {
      className = 'cm-bonsai-option';
    } else if (text.startsWith('   ') || text.startsWith('\t')) {
      className = 'cm-bonsai-indent';
    }

    if (className) {
      decorations.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({ class: className }),
      });
    }
  }

  return Decoration.set(decorations.map((d) => d.deco.range(d.from)));
}

export const lineHighlighterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = bonsaiLineHighlighter(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = bonsaiLineHighlighter(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// Create changed lines decorator
export function createChangedLinesPlugin(changedLines: Set<number>) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }
      buildDecorations(view: EditorView) {
        const builder: { from: number; deco: Decoration }[] = [];
        const doc = view.state.doc;
        for (let i = 1; i <= doc.lines; i++) {
          if (changedLines.has(i - 1)) {
            const line = doc.line(i);
            builder.push({
              from: line.from,
              deco: Decoration.line({ class: 'cm-line-changed' }),
            });
          }
        }
        return Decoration.set(builder.map((b) => b.deco.range(b.from)));
      }
      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}
