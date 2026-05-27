'use client';

/**
 * Sandbox: line-attribution diff playground.
 *
 * - "Add AI branch" appends a generic `if ...` block to the last @SCENE;
 *   new lines are tagged 'ai' (green).
 * - As you type, touched lines downgrade to 'human' (yellow). Backspace, line
 *   joins, splits, and re-typing all flow through the same `applyEdit` logic
 *   tested in `lib/attribution/attribution.test.ts`.
 *
 * Attribution lives in a CodeMirror StateField so it updates as part of the
 * same transaction as the doc change (no extra dispatches, no race).
 */

import { applyEdit, makeDoc, Source } from '@/lib/attribution';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Annotation, EditorState, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';

const INITIAL_LINES = [
  '@HOME',
  'The fire crackles softly in the hearth.',
  'You can hear the wind outside.',
  '',
  'if go outside',
  '  You step into the cold night.',
  '  goto @GARDEN',
  '',
  '@GARDEN',
  'Flowers sway gently in the breeze.',
  'The garden gate creaks.',
];

const AI_BRANCHES = [
  ['if look at the fire', '  The flames dance hypnotically.', '  You feel oddly drawn to them.'],
  ['if pick a flower', '  You pluck a small white blossom.', '  Its petals are cool to the touch.'],
  ['if listen carefully', '  A faint whisper hangs in the air.', '  You cannot make out the words.'],
];

// Marks a transaction's edits as AI-sourced. Default is human.
const aiSource = Annotation.define<boolean>();
// Marks a transaction as resetting the doc; sets attribution to all-base.
const resetSource = Annotation.define<boolean>();

const initialSource: Source[] = INITIAL_LINES.map(() => 'base');

/** Per-line attribution. Recomputed inside the transaction so it stays in sync. */
const attributionField = StateField.define<Source[]>({
  create: () => initialSource,
  update(prev, tr) {
    if (tr.annotation(resetSource)) return INITIAL_LINES.map(() => 'base');
    if (!tr.docChanged) return prev;
    const prevLines = tr.startState.doc.toString().split('\n');
    const nextLines = tr.state.doc.toString().split('\n');
    const editor = tr.annotation(aiSource) ? 'ai' : 'human';
    return applyEdit({ lines: prevLines, source: prev }, nextLines, editor).source;
  },
});

const decorationField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(_, tr) {
    const source = tr.state.field(attributionField);
    const doc = tr.state.doc;
    const ranges = [];
    for (let i = 1; i <= doc.lines; i++) {
      const cls = source[i - 1] === 'ai' ? 'cm-attr-ai' : source[i - 1] === 'human' ? 'cm-attr-human' : null;
      if (cls) ranges.push(Decoration.line({ class: cls }).range(doc.line(i).from));
    }
    return Decoration.set(ranges);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const attrTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-content': { padding: '12px' },
  '.cm-attr-ai': { backgroundColor: '#dcfce7' }, // green-100
  '.cm-attr-human': { backgroundColor: '#fef9c3' }, // yellow-100
});

export default function SandboxPage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [counts, setCounts] = useState<Record<Source, number>>({ base: INITIAL_LINES.length, ai: 0, human: 0 });
  const [branchIdx, setBranchIdx] = useState(0);

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    // Refresh the count strip after every transaction.
    const countsListener = EditorView.updateListener.of((update) => {
      const src = update.state.field(attributionField);
      const c: Record<Source, number> = { base: 0, ai: 0, human: 0 };
      for (const s of src) c[s]++;
      setCounts(c);
    });

    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: INITIAL_LINES.join('\n'),
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          attributionField,
          decorationField,
          attrTheme,
          countsListener,
          EditorView.lineWrapping,
        ],
      }),
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  const addAiBranch = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const branch = AI_BRANCHES[branchIdx % AI_BRANCHES.length];
    setBranchIdx((i) => i + 1);
    view.dispatch({
      changes: { from: view.state.doc.length, insert: '\n' + branch.join('\n') },
      annotations: aiSource.of(true),
    });
  }, [branchIdx]);

  const reset = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: INITIAL_LINES.join('\n') },
      annotations: resetSource.of(true),
    });
  }, []);

  return (
    <div className="h-screen flex flex-col p-4 gap-3 max-w-4xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <h1>diff sandbox</h1>
        <p className="text-neutral-600">
          play with line attribution. <span className="px-1 bg-green-100">green</span> = AI added,{' '}
          <span className="px-1 bg-yellow-100">yellow</span> = human-edited. logic lives in{' '}
          <code>lib/attribution/</code>, shared with the production editor's blame.
        </p>
      </header>

      <div className="flex gap-2 items-center">
        <button onClick={addAiBranch} className="px-3 py-1 bg-green-600 text-white hover:bg-green-700">
          + add AI branch to last scene
        </button>
        <button onClick={reset} className="px-3 py-1 border border-neutral-300 hover:bg-neutral-100">
          reset
        </button>
        <span className="ml-auto text-neutral-500">
          base: {counts.base} · ai: {counts.ai} · human: {counts.human}
        </span>
      </div>

      <div className="flex-1 min-h-0 border border-neutral-300 overflow-hidden">
        <div ref={editorRef} className="h-full overflow-auto" />
      </div>

      <details className="text-neutral-500">
        <summary className="cursor-pointer">edge cases to try</summary>
        <ul className="list-disc ml-6 mt-1">
          <li>add an AI branch, then backspace one char inside it → that line turns yellow</li>
          <li>delete a whole AI line → the green attribution disappears with the line</li>
          <li>backspace at the start of an AI line to join it with the previous → merged line is yellow</li>
          <li>add a brand-new line by hitting enter inside green text → both halves turn yellow</li>
          <li>type then backspace back to original AI text → stays yellow (the human now owns it)</li>
        </ul>
      </details>
    </div>
  );
}
