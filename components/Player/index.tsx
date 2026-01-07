'use client';

import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { Sender } from '@/types/playthrough';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import PlayerInput from './PlayerInput';

export default function Player({ className }: { className?: string }) {
  const { lines, status, handleNext, handleSubmit, handleRestart } = usePlayerContext();
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
        return <p className="italic text-neutral-400">(Matching...)</p>;
      case Status.GENERATING:
        return <p className="italic text-neutral-400">(Generating...)</p>;
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
      <div
        className={twMerge(
          'space-y-2 py-2 flex flex-1 flex-col overflow-scroll relative justify-between',
        )}
      >
        <div className="flex flex-col gap-2 pb-20">
          {lines.map((line, i) => {
            const isPlayer = line.sender === Sender.PLAYER;
            const isImage = line.type === 'image';

            if (isImage) {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={line.text} alt="" className="max-w-full max-h-64 rounded" />
                </motion.div>
              );
            }

            return (
              <motion.p
                key={i}
                className={twMerge(
                  line.sender === Sender.SYSTEM && 'italic text-neutral-400',
                  isPlayer && 'text-[#468D52]',
                )}
                initial={isPlayer ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1, ease: 'easeInOut' }}
              >
                {isPlayer ? '> ' : null}
                {line.text}
              </motion.p>
            );
          })}
          <div ref={endRef} />
        </div>

        <motion.div
          id={lines.length.toString()}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={twMerge('w-full', className)}
        >
          {renderStatus()}
        </motion.div>
      </div>
    </div>
  );
}
