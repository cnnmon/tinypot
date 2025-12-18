'use client';

import { useProject } from '@/lib/project';

export default function Editor() {
  const { lines, editLines } = useProject();

  return (
    <div className="flex-1 m-4 gap-2 flex flex-col">
      <p>show branch state here</p>
      <div className="h-full bg-white bordered p-4 overflow-auto rounded-lg">
        <div className="flex font-mono">
          <div className="text-neutral-400 pr-4 select-none text-right">
            {[...Array(lines.length)].map((_, i) => (
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
    </div>
  );
}
