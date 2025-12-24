'use client';

import usePlayer, { Status } from '@/lib/player';
import { useEffect, useRef } from 'react';
import PlayerInput from './PlayerInput';

export default function Player() {
  const { lines, status, handleNext, handleSubmit, handleRestart } = usePlayer();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="h-full overflow-auto flex flex-col gap-2">
      <div className="flex gap-2 justify-between">
        <i>({status})</i>
        <button onClick={handleRestart}>restart?</button>
      </div>

      <hr />

      <div className="space-y-2 h-inherit">
        {lines.map((line, i) => {
          return <p key={i}>{line.text}</p>;
        })}
        <div ref={endRef} />
      </div>

      {status === Status.RUNNING ? (
        <button disabled={status !== Status.RUNNING} onClick={handleNext}>
          next
        </button>
      ) : status === Status.WAITING ? (
        <PlayerInput handleSubmit={handleSubmit} />
      ) : null}
    </div>
  );
}
