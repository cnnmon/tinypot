'use client';

import { useProject } from '@/lib/project';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function Editor() {
  const { game, lines, editLines, viewingBranch, setViewingBranch, changedLines } = useProject();
  const editorRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<(HTMLDivElement | null)[]>([]);
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  // Update content when lines change externally (e.g., branch switch)
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerText = lines.join('\n');
    }
  }, [lines]);

  // Measure line heights after render
  useEffect(() => {
    const measureHeights = () => {
      const heights = linesRef.current.map((el) => el?.offsetHeight || 24);
      setLineHeights(heights);
    };
    measureHeights();

    // Re-measure on resize
    const observer = new ResizeObserver(measureHeights);
    linesRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [lines]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerText;
      editLines(content.split('\n'));
    }
  }, [editLines]);

  return (
    <div className="flex-1 m-4 gap-2 flex flex-col h-1/2 md:h-auto">
      {/* Branch status bar */}
      <div className="flex items-center gap-2 text-sm font-mono">
        <button
          onClick={() => setViewingBranch(null)}
          className={`px-3 py-1 rounded ${
            !viewingBranch ? 'bg-black text-white' : 'bg-neutral-200 hover:bg-neutral-300'
          }`}
        >
          main branch
        </button>

        {game.branches.map((branch, i) => (
          <button
            key={branch.id}
            onClick={() => setViewingBranch(branch)}
            className={`px-3 py-1 rounded ${
              viewingBranch?.id === branch.id
                ? 'bg-black text-white'
                : 'bg-neutral-200 hover:bg-neutral-300'
            }`}
          >
            branch {i + 1}
          </button>
        ))}
      </div>

      {/* Editor with synced line heights */}
      <div className="h-full bg-white bordered rounded-lg overflow-auto flex">
        {/* Line numbers gutter - heights synced to content */}
        <div className="flex-shrink-0 bg-neutral-50 border-r border-neutral-200 select-none font-mono text-sm pt-4">
          {lines.map((_, i) => {
            const isChanged = changedLines.has(i);
            const height = lineHeights[i] || 24;
            return (
              <div
                key={i}
                className={`px-3 text-right flex items-start ${
                  isChanged ? 'bg-yellow-200 text-yellow-800 font-bold' : 'text-neutral-400'
                }`}
                style={{ height, lineHeight: '1.5em' }}
              >
                {isChanged && '• '}
                {i + 1}
              </div>
            );
          })}
        </div>

        {/* Content area with line measurement */}
        <div className="flex-1 relative pt-4 px-4">
          {/* Invisible measurement layer */}
          <div className="absolute inset-0 pt-4 px-4 pointer-events-none" aria-hidden>
            {lines.map((line, i) => (
              <div
                key={i}
                ref={(el) => {
                  linesRef.current[i] = el;
                }}
                className={`font-mono text-sm whitespace-pre-wrap break-words ${
                  changedLines.has(i) ? 'bg-yellow-100' : ''
                }`}
                style={{ lineHeight: '1.5em', minHeight: '1.5em' }}
              >
                {line || '\u200B'}
              </div>
            ))}
          </div>

          {/* Editable layer */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            spellCheck={false}
            className="relative z-10 w-full min-h-full font-mono text-sm whitespace-pre-wrap break-words outline-none"
            style={{ lineHeight: '1.5em' }}
          >
            {lines.join('\n')}
          </div>
        </div>
      </div>
    </div>
  );
}
