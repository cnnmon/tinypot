'use client';

import { useEditor } from '@/context/editor';

export default function Editor() {
  const { lines, editLines } = useEditor();

  return (
    <div className="flex-1 bg-white bordered p-4 m-4 overflow-auto rounded-lg">
      <div className="flex font-mono">
        <div className="text-neutral-400 pr-4 select-none text-right">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          value={lines.join('\n')}
          onChange={(e) => editLines(e.target.value.split('\n'))}
          spellCheck={false}
          className="flex-1 resize-none outline-none bg-transparent"
        />
      </div>
    </div>
  );
}
