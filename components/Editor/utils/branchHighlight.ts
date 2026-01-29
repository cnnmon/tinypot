/**
 * CodeMirror plugin for highlighting lines in scenes belonging to a selected branch.
 *
 * Highlighting levels:
 * - Gray: Entire affected scene background
 * - Yellow: Lines that match AI-generated content (unchanged)
 * - Green: Lines that differ from generated (human edits)
 */

import { Branch, Scene, SceneId } from '@/types/branch';
import { EntryType, SchemaEntry } from '@/types/schema';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

// Extract the primary identifier from a schema entry for comparison
// For options, this is just the option text (ignoring aliases)
function entryToComparisonKey(entry: SchemaEntry): string {
  switch (entry.type) {
    case EntryType.NARRATIVE:
      return `narrative:${entry.text}`;
    case EntryType.OPTION:
      // Compare by primary option text only, ignoring aliases
      return `option:${entry.text}`;
    case EntryType.JUMP:
      return `jump:${entry.target}`;
    case EntryType.SCENE:
      return `scene:${entry.label}`;
    case EntryType.IMAGE:
      return `image:${entry.url}`;
    case EntryType.METADATA:
      return `metadata:${entry.key}:${entry.value}`;
    default:
      return '';
  }
}

// Convert scene to comparison keys for lookup
function sceneToComparisonKeys(scene: Scene): Set<string> {
  return new Set(scene.map((entry) => entryToComparisonKey(entry).toLowerCase()));
}

// Parse a line from the editor and return its comparison key
function lineToComparisonKey(line: string): string {
  const trimmed = line.trim();

  // Choice line: if text | alias1 | alias2 & [condition]
  if (trimmed.startsWith('if ')) {
    let content = trimmed.slice(3).trim();
    // Remove condition at end: ... & [var]
    const conditionMatch = content.match(/&\s*\[([^\]]+)\]\s*$/);
    if (conditionMatch) {
      content = content.slice(0, content.lastIndexOf('&')).trim();
    }
    // Extract primary text (before |)
    const primaryText = content.split('|')[0].trim();
    return `option:${primaryText}`;
  }

  // Jump line: goto @target
  if (trimmed.startsWith('goto ')) {
    const target = trimmed.slice(5).trim();
    // Remove @ prefix if present
    const cleanTarget = target.startsWith('@') ? target.slice(1) : target;
    return `jump:${cleanTarget}`;
  }

  // Image directive: [image: url]
  const imageMatch = trimmed.match(/^\[image:\s*(.+)\]$/);
  if (imageMatch) {
    return `image:${imageMatch[1]}`;
  }

  // Other metadata: [key: value]
  const metadataMatch = trimmed.match(/^\[(\w+):\s*(.+)\]$/);
  if (metadataMatch) {
    return `metadata:${metadataMatch[1]}:${metadataMatch[2]}`;
  }

  // Default: narrative
  return `narrative:${trimmed}`;
}

// State effect to update branch highlight state
export const setBranchHighlight = StateEffect.define<{
  sceneToBranchMap: Record<SceneId, string>;
  selectedBranch: Branch | null;
}>();

// State field to hold branch highlight state
export const branchHighlightState = StateField.define<{
  sceneToBranchMap: Record<SceneId, string>;
  selectedBranch: Branch | null;
}>({
  create() {
    return { sceneToBranchMap: {}, selectedBranch: null };
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setBranchHighlight)) {
        return e.value;
      }
    }
    return value;
  },
});

// Build decorations for branch highlighting
function buildBranchDecorations(view: EditorView): DecorationSet {
  const state = view.state.field(branchHighlightState);
  const { selectedBranch } = state;

  // Need a selected branch with affected scenes to highlight
  if (!selectedBranch || selectedBranch.sceneIds.length === 0) {
    return Decoration.none;
  }

  // Check if this is a rejected branch
  const isRejected = selectedBranch.approved === false;

  // Create a Set for fast lookup of affected scenes
  const affectedScenes = new Set(selectedBranch.sceneIds);

  const decorations: { from: number; deco: Decoration }[] = [];
  const doc = view.state.doc;
  let currentSceneId: string = 'START'; // Default to START for content before first scene

  // Parse document to find scenes and apply decorations
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmed = line.text.trimStart();

    // Track scene boundaries (new syntax: @SCENE_NAME)
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      currentSceneId = trimmed.slice(1).trim();
      continue; // Don't highlight the scene header itself
    }

    const isEmptyLine = trimmed === '';

    // Check if current scene is affected by the selected branch
    if (affectedScenes.has(currentSceneId)) {
      // Get both base and generated scenes for comparison
      const baseScene = selectedBranch.base[currentSceneId];
      const generatedScene = selectedBranch.generated[currentSceneId];

      const baseKeys = baseScene ? sceneToComparisonKeys(baseScene) : new Set<string>();
      const generatedKeys = generatedScene ? sceneToComparisonKeys(generatedScene) : new Set<string>();

      // Determine line type based on presence in base vs generated
      let lineClass = 'cm-branch-scene'; // Default: gray (affected scene)

      if (!isEmptyLine) {
        const lineKey = lineToComparisonKey(trimmed).toLowerCase();
        const inBase = baseKeys.has(lineKey);
        const inGenerated = generatedKeys.has(lineKey);

        if (isRejected) {
          // For rejected branches, highlight generated content in red
          if (inGenerated && !inBase) {
            lineClass = 'cm-branch-rejected'; // Red with strikethrough
          }
          // Other lines in affected scenes stay gray
        } else {
          // Normal (unresolved or approved) branch highlighting
          if (inGenerated && !inBase) {
            // Line exists in generated but NOT in base = AI-added
            lineClass = 'cm-branch-generated'; // Yellow
          } else if (!inGenerated && !inBase) {
            // Line is not in generated and not in base = human-edited after generation
            lineClass = 'cm-branch-edited'; // Green
          }
          // If inBase = pre-existing, stays gray
        }
      }

      decorations.push({
        from: line.from,
        deco: Decoration.line({ class: lineClass }),
      });
    }
  }

  return Decoration.set(decorations.map((d) => d.deco.range(d.from)));
}

// View plugin for branch highlighting
export const branchHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildBranchDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild decorations when document changes or branch state changes
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setBranchHighlight)))
      ) {
        this.decorations = buildBranchDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// CSS for branch highlighting - four levels
export const branchHighlightTheme = EditorView.theme({
  // Gray - affected scene background
  '.cm-branch-scene': {
    backgroundColor: 'none', // gray-400 at 10%
  },
  // Yellow - AI generated, unchanged
  '.cm-branch-generated': {
    backgroundColor: '#FFFBE3', // amber-400 at 20%
  },
  // Green - human edited
  '.cm-branch-edited': {
    backgroundColor: '#dcebcd', // green-500 at 20%
  },
  // Red - rejected content (shown when viewing rejected branch)
  '.cm-branch-rejected': {
    backgroundColor: '#FEE2E2', // red-100
    textDecoration: 'line-through',
    opacity: 0.8,
  },
});
