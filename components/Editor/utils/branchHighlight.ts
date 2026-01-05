/**
 * CodeMirror plugin for highlighting lines in scenes belonging to a selected branch.
 *
 * Highlighting levels:
 * - Gray: Entire affected scene background
 * - Yellow: Lines that match AI-generated content (unchanged)
 * - Green: Lines that differ from generated (human edits)
 */

import { Branch, Scene } from '@/types/branch';
import { EntryType, SchemaEntry } from '@/types/schema';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

// Convert schema entry to text for comparison
function entryToText(entry: SchemaEntry): string {
  switch (entry.type) {
    case EntryType.NARRATIVE:
      return entry.text;
    case EntryType.OPTION:
      return `* ${entry.text}`;
    case EntryType.JUMP:
      return `> ${entry.target}`;
    case EntryType.SCENE:
      return `# ${entry.label}`;
    default:
      return '';
  }
}

// Convert scene to normalized text lines for comparison
function sceneToTextLines(scene: Scene): string[] {
  return scene.map((entry) => entryToText(entry).trim().toLowerCase());
}

// State effect to update branch highlight state
export const setBranchHighlight = StateEffect.define<{
  sceneToBranchMap: Map<string, string>;
  selectedBranch: Branch | null;
}>();

// State field to hold branch highlight state
export const branchHighlightState = StateField.define<{
  sceneToBranchMap: Map<string, string>;
  selectedBranch: Branch | null;
}>({
  create() {
    return { sceneToBranchMap: new Map(), selectedBranch: null };
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

  // Create a Set for fast lookup of affected scenes
  const affectedScenes = new Set(selectedBranch.sceneIds);

  const decorations: { from: number; deco: Decoration }[] = [];
  const doc = view.state.doc;
  let currentSceneId: string | null = null;

  // Parse document to find scenes and apply decorations
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmed = line.text.trimStart();

    // Track scene boundaries
    if (trimmed.startsWith('#')) {
      currentSceneId = trimmed.slice(1).trim();
      continue; // Don't highlight the scene header itself
    }

    const isEmptyLine = trimmed === '';

    // Check if current scene is affected by the selected branch
    if (currentSceneId && affectedScenes.has(currentSceneId)) {
      // Get both base and generated scenes for comparison
      const baseScene = selectedBranch.base.get(currentSceneId);
      const generatedScene = selectedBranch.generated.get(currentSceneId);

      const baseLines = baseScene ? sceneToTextLines(baseScene) : [];
      const generatedLines = generatedScene ? sceneToTextLines(generatedScene) : [];

      // Normalize current line for comparison
      const currentLineNormalized = trimmed.toLowerCase();

      // Determine line type based on presence in base vs generated
      let lineClass = 'cm-branch-scene'; // Default: gray (affected scene)

      if (!isEmptyLine) {
        const inBase = baseLines.includes(currentLineNormalized);
        const inGenerated = generatedLines.includes(currentLineNormalized);

        if (inGenerated && !inBase) {
          // Line exists in generated but NOT in base = AI-added
          lineClass = 'cm-branch-generated'; // Yellow
        } else if (!inGenerated && !inBase) {
          // Line is not in generated and not in base = human-edited after generation
          lineClass = 'cm-branch-edited'; // Green
        }
        // If inBase = pre-existing, stays gray
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

// CSS for branch highlighting - three levels
export const branchHighlightTheme = EditorView.theme({
  // Gray - affected scene background
  '.cm-branch-scene': {
    backgroundColor: '#D7DFE34E', // gray-400 at 10%
  },
  // Yellow - AI generated, unchanged
  '.cm-branch-generated': {
    backgroundColor: '#FFFBE3', // amber-400 at 20%
  },
  // Green - human edited
  '.cm-branch-edited': {
    backgroundColor: '#dcebcd', // green-500 at 20%
  },
});
