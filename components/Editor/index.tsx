'use client';

import { isResolved } from '@/lib/branch';
import useEditor from '@/lib/editor';
import { useProject } from '@/lib/project';
import { Branch, Scene, SceneId } from '@/types/branch';
import { Entity } from '@/types/entities';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useMemo, useRef } from 'react';
import {
  blameHighlightPlugin,
  blameHighlightState,
  blameHighlightTheme,
  setBlameHighlight,
} from './utils/blameHighlight';
import {
  branchHighlightPlugin,
  branchHighlightState,
  branchHighlightTheme,
  setBranchHighlight,
} from './utils/branchHighlight';
import { bonsaiHighlighting, bonsaiSyntaxTheme, bonsaiTheme, lineHighlighterPlugin } from './utils/theme';

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

export default function Editor({
  readOnly = false,
  branch: branchProp,
}: {
  readOnly?: boolean;
  branch?: Branch | null;
}) {
  const { script, setScript, blame, cursorLine, currentLineBlame, updateCursorLine } = useEditor();
  const { branches, sceneToBranchMap, selectedBranchId } = useProject();

  // Use prop branch if provided, otherwise fall back to context selection
  const selectedBranch =
    branchProp !== undefined
      ? branchProp
      : selectedBranchId
        ? (branches.find((b) => b.id === selectedBranchId) ?? null)
        : null;

  // Check if viewing a rejected branch
  const isViewingRejected = useMemo(() => {
    return selectedBranch ? isResolved(selectedBranch) && selectedBranch.approved === false : false;
  }, [selectedBranch]);

  // For rejected branches, reconstruct with generated content
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

  // Track if we should sync changes to project
  // Sync when: not read-only AND (no branch OR branch is unresolved)
  // Use a ref so the closure in updateListener always gets the current value
  const shouldSyncToProjectRef = useRef(!readOnly);
  shouldSyncToProjectRef.current = !readOnly;

  // Track when we're syncing external changes to avoid triggering saves
  const isSyncingExternalRef = useRef(false);

  // Track updateCursorLine in a ref so we can use it in the listener
  const updateCursorLineRef = useRef(updateCursorLine);
  updateCursorLineRef.current = updateCursorLine;

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
      }

      // Track cursor position for blame display
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos).number - 1; // 0-indexed
        updateCursorLineRef.current(line);
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
        blameHighlightTheme,
        lineHighlighterPlugin,
        branchHighlightState,
        branchHighlightPlugin,
        blameHighlightState,
        blameHighlightPlugin,
        syntaxHighlighting(bonsaiHighlighting),
        updateListener,
        EditorView.lineWrapping,
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly || isViewingRejected)),
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

    // Always update when viewing rejected (to show snapshot content)
    // Otherwise only update when not focused
    if (currentContent !== newContent && (isViewingRejected || !view.hasFocus)) {
      // Mark that we're syncing external changes so updateListener doesn't trigger saves
      isSyncingExternalRef.current = true;
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: newContent },
      });
      // Reset after microtask to ensure updateListener sees the flag
      queueMicrotask(() => {
        isSyncingExternalRef.current = false;
      });
    }
  }, [displayScript, isViewingRejected]);

  // Toggle read-only mode when viewing rejected branches or readOnly prop is set
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly || isViewingRejected)),
    });
  }, [readOnly, isViewingRejected]);

  // Update branch highlighting when selection changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: setBranchHighlight.of({ sceneToBranchMap, selectedBranch: selectedBranch ?? null }),
    });
  }, [sceneToBranchMap, selectedBranch]);

  // Update blame highlighting when blame data changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: setBlameHighlight.of(blame),
    });
  }, [blame]);

  // Check if viewing any resolved branch (approved or rejected)
  const isViewingResolved = selectedBranch ? isResolved(selectedBranch) : false;

  // Get blame label for display
  const blameLabel = currentLineBlame === Entity.SYSTEM ? 'ai' : currentLineBlame === Entity.AUTHOR ? 'you' : null;

  return (
    <div className="h-full overflow-y-scroll relative">
      <div ref={editorRef} className="h-full pb-10" />
      {isViewingResolved && (
        <div className="absolute top-0 px-2 py-1 text-sm bg-white rounded bordered m-2">
          Read-only ({selectedBranch?.approved ? 'approved' : 'rejected'})
        </div>
      )}
      {/* Line indicator with blame */}
      <div className="absolute w-full bottom-0 p-2 text-right text-sm bg-gradient-to-b from-[#EBF7D2] border-t-2">
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
  );
}
