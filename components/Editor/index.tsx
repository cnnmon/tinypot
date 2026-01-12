'use client';

import { isResolved } from '@/lib/branch';
import useEditor from '@/lib/editor';
import { useProject } from '@/lib/project';
import { Scene, SceneId } from '@/types/branch';
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

/**
 * Reconstruct the script with generated content for rejected branch preview.
 * Takes the baseScript and injects generated scenes back into it.
 */
function reconstructScriptWithGenerated(
  baseScript: string[],
  generated: Record<SceneId, Scene>,
  sceneIds: string[],
): string[] {
  // Parse script to find scene positions
  const result: string[] = [];
  let currentSceneId: string | null = null;
  let currentSceneStart = -1;
  const sceneRanges: { sceneId: string; start: number; end: number }[] = [];

  // First pass: find scene boundaries
  for (let i = 0; i < baseScript.length; i++) {
    const trimmed = baseScript[i].trim();
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      if (currentSceneId !== null) {
        sceneRanges.push({ sceneId: currentSceneId, start: currentSceneStart, end: i });
      }
      currentSceneId = trimmed.slice(1).trim();
      currentSceneStart = i;
    }
  }
  if (currentSceneId !== null) {
    sceneRanges.push({ sceneId: currentSceneId, start: currentSceneStart, end: baseScript.length });
  }

  // Build a map of scene positions
  const scenePositions = new Map(sceneRanges.map((r) => [r.sceneId, r]));

  // Second pass: reconstruct with generated content
  let i = 0;
  while (i < baseScript.length) {
    const line = baseScript[i];
    const trimmed = line.trim();

    // Check if this is a scene header for an affected scene
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      const sceneId = trimmed.slice(1).trim();
      const range = scenePositions.get(sceneId);

      if (range && sceneIds.includes(sceneId) && generated[sceneId]) {
        // Add the scene header
        result.push(line);
        // Add the generated content for this scene
        const generatedScene = generated[sceneId];
        for (const entry of generatedScene) {
          result.push(sceneEntryToLine(entry));
        }
        // Skip to end of this scene in original
        i = range.end;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result;
}

/**
 * Convert a scene entry back to a script line
 */
function sceneEntryToLine(entry: Scene[number]): string {
  switch (entry.type) {
    case 'narrative':
      return entry.text;
    case 'option':
      const aliases = entry.aliases?.length ? ` | ${entry.aliases.join(' | ')}` : '';
      return `if ${entry.text}${aliases}`;
    case 'goto':
      return `goto @${entry.target}`;
    case 'image':
      return `[image: ${entry.url}]`;
    case 'metadata':
      return `[${entry.key}: ${entry.value}]`;
    default:
      return '';
  }
}

export default function Editor() {
  const { script, setScript } = useEditor();
  const { branches, sceneToBranchMap, selectedBranchId } = useProject();

  // Get the selected branch object for detailed highlighting
  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null;

  // Check if viewing a rejected branch
  const isViewingRejected = useMemo(() => {
    return selectedBranch ? isResolved(selectedBranch) && selectedBranch.approved === false : false;
  }, [selectedBranch]);

  // For rejected branches, reconstruct the script with generated content
  const displayScript = useMemo(() => {
    if (isViewingRejected && selectedBranch?.baseScript && selectedBranch.generated) {
      return reconstructScriptWithGenerated(
        selectedBranch.baseScript,
        selectedBranch.generated as Record<SceneId, Scene>,
        selectedBranch.sceneIds,
      );
    }
    return script;
  }, [isViewingRejected, selectedBranch, script]);

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
      doc: displayScript.join('\n'),
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

  // Sync content when lines change externally (or when switching to rejected branch preview)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    const newContent = displayScript.join('\n');

    // Always update when viewing rejected (to show generated content)
    // Otherwise only update when not focused
    if (currentContent !== newContent && (isViewingRejected || !view.hasFocus)) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: newContent },
      });
    }
  }, [displayScript, isViewingRejected]);

  // Toggle read-only mode when viewing rejected branches
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(isViewingRejected)),
    });
  }, [isViewingRejected]);

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
      {isViewingRejected && (
        <div className="absolute top-0 px-2 py-1 text-sm bg-white rounded bordered">
          Viewing rejected changes
        </div>
      )}
    </div>
  );
}
