'use client';

import useEditor from '@/lib/editor';
import { Entity } from '@/types/entities';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import {
  blameHighlightPlugin,
  blameHighlightState,
  blameHighlightTheme,
  markLineReviewed,
  setBlameHighlight,
} from './utils/blameHighlight';
import { bonsaiHighlighting, bonsaiSyntaxTheme, bonsaiTheme, lineHighlighterPlugin } from './utils/theme';
import { slashMenuPlugin, slashMenuState, slashMenuKeymap } from './utils/slashMenu';
import './utils/slashMenu.css';

// Compartment for dynamically toggling read-only mode
const readOnlyCompartment = new Compartment();

export default function Editor({ readOnly = false }: { readOnly?: boolean }) {
  const { script, setScript, blame, cursorLine, currentLineBlame, updateCursorLine, hasUnresolvedAiLines, dismissHighlights } = useEditor();
  
  // Track reviewed lines (AI lines that author has edited)
  const reviewedLinesRef = useRef<Set<number>>(new Set());

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Track if we should sync changes to project
  const shouldSyncToProjectRef = useRef(!readOnly);
  shouldSyncToProjectRef.current = !readOnly;

  // Track when we're syncing external changes to avoid triggering saves
  const isSyncingExternalRef = useRef(false);

  // Track updateCursorLine in a ref so we can use it in the listener
  const updateCursorLineRef = useRef(updateCursorLine);
  updateCursorLineRef.current = updateCursorLine;
  
  // Track blame in a ref for the update listener
  const blameRef = useRef(blame);
  blameRef.current = blame;

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      // Only sync to project when:
      // - document changed
      // - not read-only
      // - not syncing external changes (to avoid overwriting AI-authored versions)
      if (update.docChanged && shouldSyncToProjectRef.current && !isSyncingExternalRef.current) {
        const content = update.state.doc.toString();
        setScript(content.split('\n'));
        
        // Detect which lines were changed and mark AI lines as reviewed
        const currentBlame = blameRef.current;
        update.changes.iterChangedRanges((fromA, toA) => {
          // Find which lines were affected by this change
          const startLine = update.startState.doc.lineAt(fromA).number - 1;
          const endLine = update.startState.doc.lineAt(Math.max(fromA, toA - 1)).number - 1;
          
          for (let lineIdx = startLine; lineIdx <= endLine; lineIdx++) {
            // If this was an AI line, mark it as reviewed
            if (currentBlame[lineIdx] === Entity.SYSTEM && !reviewedLinesRef.current.has(lineIdx)) {
              reviewedLinesRef.current.add(lineIdx);
              update.view.dispatch({ effects: markLineReviewed.of(lineIdx) });
            }
          }
        });
      }

      // Track cursor position for blame display
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos).number - 1; // 0-indexed
        updateCursorLineRef.current(line);
      }
    });

    const state = EditorState.create({
      doc: script.join('\n'),
      extensions: [
        lineNumbers(),
        keymap.of([indentWithTab, ...defaultKeymap]),
        bonsaiTheme,
        bonsaiSyntaxTheme,
        blameHighlightTheme,
        lineHighlighterPlugin,
        blameHighlightState,
        blameHighlightPlugin,
        slashMenuState,
        slashMenuPlugin,
        slashMenuKeymap,
        syntaxHighlighting(bonsaiHighlighting),
        updateListener,
        EditorView.lineWrapping,
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
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

    // Only update when not focused (external change)
    if (currentContent !== newContent && !view.hasFocus) {
      isSyncingExternalRef.current = true;
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: newContent },
      });
      queueMicrotask(() => {
        isSyncingExternalRef.current = false;
      });
    }
  }, [script]);

  // Toggle read-only mode
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Update blame highlighting when blame data or visibility changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: setBlameHighlight.of({
        blame,
        reviewedLines: reviewedLinesRef.current,
        showHighlighting: hasUnresolvedAiLines,
      }),
    });
  }, [blame, hasUnresolvedAiLines]);

  // Get blame label for display
  const blameLabel = currentLineBlame === Entity.SYSTEM ? 'ai' : currentLineBlame === Entity.AUTHOR ? 'you' : null;

  return (
    <div className="h-full overflow-y-scroll relative">
      <div ref={editorRef} className="h-full pb-10" />
      {/* Line indicator with blame and dismiss button */}
      <div className="absolute w-full bottom-0 p-2 text-sm bg-gradient-to-b from-[#EBF7D2] border-t-2 flex justify-between items-center">
        <div>
          {hasUnresolvedAiLines && !readOnly && (
            <button
              onClick={dismissHighlights}
              className="text-orange-600 hover:text-orange-800"
            >
              dismiss highlights
            </button>
          )}
        </div>
        <div>
          <span className="opacity-50">line {cursorLine + 1}/{script.length}</span>
          {blameLabel && (
            <>
              <span className="opacity-50 mx-2">·</span>
              <span className="opacity-50">last edit:</span>{' '}
              <span className={currentLineBlame === Entity.SYSTEM ? 'text-orange-600' : 'text-neutral-700'}>
                {blameLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
