import { HighlightStyle } from '@codemirror/language';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { tags } from '@lezer/highlight';

// Custom syntax highlighting for bonsai language
export const bonsaiHighlighting = HighlightStyle.define([
  { tag: tags.heading, color: '#7c3aed', fontWeight: 'bold' }, // @SCENE
  { tag: tags.link, color: '#0891b2' }, // goto @SCENE
  { tag: tags.list, color: '#059669' }, // if Choice
  { tag: tags.string, color: '#6b7280' }, // indented content
  { tag: tags.meta, color: '#d97706' }, // [key: value] metadata
]);

// Theme for the editor
export const bonsaiTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    lineHeight: '1.5',
    backgroundColor: '',
  },
  '.cm-content': {
    padding: '16px 16px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
    color: '#a3a3a3',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 0px 0 8px',
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
  // Autocomplete styling - minimalistic Notion-style
  '.cm-tooltip-autocomplete': {
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    backgroundColor: 'white',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    padding: '4px 0',
    fontSize: '14px',
    minWidth: '200px',
  },
  '.cm-completionLabel': {
    fontSize: '14px',
  },
  '.cm-completionDetail': {
    fontSize: '12px',
    color: '#9ca3af',
    marginLeft: '8px',
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    fontWeight: '500',
  },
  '.cm-completionIcon': {
    opacity: '0.5',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '6px 12px',
    cursor: 'pointer',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: '#f3f4f6',
  },
});

// Additional theme for bonsai syntax
export const bonsaiSyntaxTheme = EditorView.theme({
  '.cm-bonsai-scene': {
    color: '#5187DF',
    fontWeight: 'bold',
  },
  '.cm-bonsai-scene-start': {
    color: '#dc2626',
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
  '.cm-bonsai-image': {
    color: '#d97706',
    fontStyle: 'italic',
  },
  '.cm-bonsai-metadata': {
    color: '#9333ea',
    fontStyle: 'italic',
  },
  '.cm-bonsai-when': {
    color: '#0891b2',
    fontStyle: 'italic',
  },
  '.cm-bonsai-set': {
    color: '#16a34a',
  },
  '.cm-bonsai-unset': {
    color: '#dc2626',
  },
});

// Custom highlighter that applies styles based on line content
function bonsaiLineHighlighter(view: EditorView) {
  const decorations: { from: number; to: number; deco: Decoration }[] = [];
  const doc = view.state.doc;
  // Map<sceneName, hasBeenSeen> - value is true if already encountered in second pass
  const sceneMap = new Map<string, boolean>();

  // First pass: collect all valid scene names (new syntax: @SCENE_NAME)
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmed = line.text.trimStart().toLowerCase();

    if (trimmed.startsWith('@') && !trimmed.startsWith('@end')) {
      const sceneName = trimmed.slice(1).trim();
      if (!sceneMap.has(sceneName)) sceneMap.set(sceneName, false);
    }
  }

  // Second pass: apply decorations
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const trimmed = text.trimStart().toLowerCase();

    let className = '';
    // Scene declaration: @SCENE_NAME
    if (trimmed.startsWith('@') && !trimmed.startsWith('@end')) {
      const sceneName = trimmed.slice(1).trim();
      if (sceneName === 'start' || sceneMap.get(sceneName)) {
        className = 'cm-bonsai-scene-start';
      } else {
        className = 'cm-bonsai-scene';
        sceneMap.set(sceneName, true);
      }
    } else if (trimmed.startsWith('@end')) {
      className = 'cm-bonsai-scene-start'; // END is special
    } else if (trimmed.startsWith('goto ')) {
      // Jump: goto @TARGET
      const gotoTarget = trimmed.slice(5).trim();
      // Remove @ prefix if present
      const cleanTarget = gotoTarget.startsWith('@') ? gotoTarget.slice(1) : gotoTarget;
      const isValidTarget =
        !cleanTarget || sceneMap.has(cleanTarget) || cleanTarget === 'start' || cleanTarget === 'end';
      if (!isValidTarget) {
        className = 'cm-bonsai-scene-start'; // Use red color for invalid goto
      } else {
        className = 'cm-bonsai-goto';
      }
    } else if (trimmed.startsWith('if ')) {
      // Choice: if Choice text | alias
      className = 'cm-bonsai-option';
    } else if (trimmed.startsWith('when ')) {
      // Conditional block: when [key]
      className = 'cm-bonsai-when';
    } else if (/^\[image:\s*.+\]$/.test(trimmed)) {
      // Image metadata: [image: url]
      className = 'cm-bonsai-image';
    } else if (/^\[\w+:\s*.+\]$/.test(trimmed)) {
      // Other metadata: [key: value]
      className = 'cm-bonsai-metadata';
    } else if (/^\+\w+$/.test(trimmed)) {
      // Variable set: +key
      className = 'cm-bonsai-set';
    } else if (/^-\w+$/.test(trimmed)) {
      // Variable unset: -key
      className = 'cm-bonsai-unset';
    } else if (/^\s+/.test(text) && trimmed.length > 0) {
      // Any leading whitespace (tab, spaces, or mix) = indented content
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
  { decorations: (v) => v.decorations },
);
