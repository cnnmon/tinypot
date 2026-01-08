'use client';

import useEditor from '@/lib/editor';
import { useProject } from '@/lib/project';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import {
  branchHighlightPlugin,
  branchHighlightState,
  branchHighlightTheme,
  setBranchHighlight,
} from './utils/branchHighlight';
import {
  bonsaiHighlighting,
  bonsaiSyntaxTheme,
  bonsaiTheme,
  lineHighlighterPlugin,
} from './utils/theme';

export default function Editor() {
  const { script, setScript } = useEditor();
  const { branches, sceneToBranchMap, selectedBranchId } = useProject();

  // Get the selected branch object for detailed highlighting
  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null;

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        setScript(content.split('\n'));
      }
    });

    const state = EditorState.create({
      doc: script.join('\n'),
      extensions: [
        lineNumbers(),
        keymap.of([indentWithTab, ...defaultKeymap]),
        bonsaiTheme,
        bonsaiSyntaxTheme,
        branchHighlightTheme,
        lineHighlighterPlugin,
        branchHighlightState,
        branchHighlightPlugin,
        syntaxHighlighting(bonsaiHighlighting),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync content when lines change externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    const newContent = script.join('\n');

    if (currentContent !== newContent && !view.hasFocus) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: newContent },
      });
    }
  }, [script]);

  // Update branch highlighting when selection changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: setBranchHighlight.of({ sceneToBranchMap, selectedBranch: selectedBranch ?? null }),
    });
  }, [sceneToBranchMap, selectedBranch]);

  return (
    <div className="h-full overflow-scroll relative">
      <div ref={editorRef} className="h-full" />
    </div>
  );
}
