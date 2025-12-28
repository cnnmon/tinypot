'use client';

import usePlayer, { Status } from '@/lib/player';
import { Sender } from '@/types/playthrough';
import { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import PlayerInput from './PlayerInput';

export default function Player() {
  const { lines, status, handleNext, handleSubmit, handleRestart } = usePlayer();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function renderStatus() {
    switch (status) {
      case Status.RUNNING:
        return (
          <button disabled={status !== Status.RUNNING} onClick={handleNext}>
            Next
          </button>
        );
      case Status.WAITING:
        return <PlayerInput handleSubmit={handleSubmit} />;
      case Status.MATCHING:
        return <p className="italic">(Matching...)</p>;
      case Status.GENERATING:
        return <p className="italic">(Generating...)</p>;
      case Status.ENDED:
        return (
          <div className="flex gap-2">
            <p>END.</p>
            <button onClick={handleRestart}>Restart?</button>
          </div>
        );
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 justify-between border-b pb-2">
        <button onClick={handleRestart}>Restart?</button>
      </div>

      <div className="space-y-2 py-2 h-[calc(100%-50px)] overflow-auto">
        {lines.map((line, i) => {
          return (
            <p
              key={i}
              className={twMerge(
                line.sender === Sender.SYSTEM && 'italic',
                line.sender === Sender.NARRATOR && 'text-right',
              )}
            >
              {line.sender === Sender.PLAYER ? '> ' : null}
              {line.text}
            </p>
          );
        })}
        {renderStatus()}
        <div ref={endRef} />
      </div>
    </div>
  );
}
