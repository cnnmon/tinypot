'use client';

import { useProject } from '@/lib/project';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import {
  bonsaiHighlighting,
  bonsaiSyntaxTheme,
  bonsaiTheme,
  createChangedLinesPlugin,
  lineHighlighterPlugin,
} from './utils';

export default function Composer() {
  const { lines, editLines, changedLines } = useProject();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changedLinesCompartment = useRef(new Compartment());

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        editLines(content.split('\n'));
      }
    });

    const state = EditorState.create({
      doc: lines.join('\n'),
      extensions: [
        lineNumbers(),
        keymap.of([indentWithTab, ...defaultKeymap]),
        bonsaiTheme,
        bonsaiSyntaxTheme,
        lineHighlighterPlugin,
        syntaxHighlighting(bonsaiHighlighting),
        changedLinesCompartment.current.of(createChangedLinesPlugin(changedLines)),
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
    const newContent = lines.join('\n');

    if (currentContent !== newContent && !view.hasFocus) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: newContent },
      });
    }
  }, [lines]);

  // Update changed lines highlighting
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: changedLinesCompartment.current.reconfigure(createChangedLinesPlugin(changedLines)),
    });
  }, [changedLines]);

  return <div ref={editorRef} className="h-full bordered rounded-lg bg-white overflow-scroll" />;
}
