'use client';

import { useState } from 'react';
import Browser from './Browser';

export default function Editor() {
  const [code, setCode] = useState('The fire burns brightly.\ngoto FIRE');

  const output = code
    .split('\n')
    .filter((line) => !line.startsWith('goto'))
    .join('\n');

  const lines = code.split('\n');

  return (
    <Browser className="flex-col md:flex-row">
      {/* editor */}
      <div className="flex-1 bg-white bordered p-6 m-4 overflow-auto">
        <div className="flex font-mono">
          <div className="text-neutral-400 pr-4 select-none text-right">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none outline-none bg-transparent"
          />
        </div>
      </div>

      {/* game */}
      <div
        className="flex-1 border-t-[2.5px] md:border-t-0 md:border-l-[2.5px] p-6 overflow-auto"
        style={{
          background: 'linear-gradient(180deg, var(--color-lime) 0%, #ffffff 100%)',
        }}
      >
        <pre className="font-mono whitespace-pre-wrap">{output}</pre>
      </div>
    </Browser>
  );
}
