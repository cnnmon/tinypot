'use client';

import { isResolved } from '@/lib/branch';
import useEditor from '@/lib/editor';
import { useProject } from '@/lib/project';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useMemo, useRef } from 'react';
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

// Compartment for dynamically toggling read-only mode
const readOnlyCompartment = new Compartment();

export default function Editor() {
  const { script, setScript } = useEditor();
  const { branches, sceneToBranchMap, selectedBranchId, setSelectedBranchId } = useProject();

  // Get the selected branch object for detailed highlighting
  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null;

  // Check if viewing a resolved branch (should be read-only)
  const isViewingResolved = useMemo(() => {
    return selectedBranch ? isResolved(selectedBranch) : false;
  }, [selectedBranch]);

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

      // Auto-select branch when cursor moves to a branch scene
      if (update.selectionSet && sceneToBranchMap.size > 0) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);

        // Find which scene this line is in
        let currentScene: string | null = null;
        for (let i = 1; i <= line.number; i++) {
          const l = update.state.doc.line(i);
          const trimmed = l.text.trimStart();
          if (trimmed.startsWith('#')) {
            currentScene = trimmed.slice(1).trim();
          }
        }

        // Check if scene belongs to a branch
        if (currentScene) {
          const branchId = sceneToBranchMap.get(currentScene);
          if (branchId && branchId !== selectedBranchId) {
            setSelectedBranchId(branchId);
          }
        }
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
        readOnlyCompartment.of(EditorState.readOnly.of(false)),
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

  // Toggle read-only mode when viewing resolved branches
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(isViewingResolved)),
    });
  }, [isViewingResolved]);

  return (
    <div className="h-full overflow-scroll relative">
      <div ref={editorRef} className="h-full" />
      {isViewingResolved && (
        <div className="absolute top-0 right-0 px-2 py-1 text-sm bg-neutral-100 text-neutral-400 rounded">
          Read only (resolved branch)
        </div>
      )}
    </div>
  );
}
