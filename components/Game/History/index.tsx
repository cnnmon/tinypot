'use client';

import { useProject } from '@/lib/project';
import { GameStatus } from '@/types/games';
import { useEffect, useRef } from 'react';

export default function History() {
  const { gameState } = useProject();
  const { history, status } = gameState;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div className="p-4 font-mono space-y-2">
      {history.map((entry, i) => (
        <p key={i}>{'text' in entry ? entry.text : entry.input}</p>
      ))}
      {status === GameStatus.ENDED && <p>END.</p>}
      <div ref={endRef} />
    </div>
  );
}
