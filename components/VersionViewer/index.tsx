'use client';

import { syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { diffHighlightPlugin, diffHighlightState, diffHighlightTheme, setDiffHighlight } from '../Editor/utils/diffHighlight';
import { bonsaiHighlighting, bonsaiSyntaxTheme, bonsaiTheme } from '../Editor/utils/theme';

interface VersionViewerProps {
  /** The version's script to display */
  script: string[];
  /** The previous version's script for diff comparison */
  previousScript: string[];
}

/**
 * Read-only viewer for historical versions.
 * Completely separate from the main Editor to prevent any save triggers.
 */
export default function VersionViewer({ script, previousScript }: VersionViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Initialize CodeMirror (read-only, no update listener)
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous instance if exists
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: script.join('\n'),
      extensions: [
        lineNumbers(),
        bonsaiTheme,
        bonsaiSyntaxTheme,
        diffHighlightTheme,
        diffHighlightState,
        diffHighlightPlugin,
        syntaxHighlighting(bonsaiHighlighting),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    // Apply diff highlighting
    viewRef.current.dispatch({
      effects: setDiffHighlight.of({
        versionScript: script,
        currentScript: previousScript,
      }),
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [script, previousScript]);

  return (
    <div className="h-full overflow-y-scroll relative bg-zinc-100">
      <div ref={containerRef} className="h-full" />
    </div>
  );
}
