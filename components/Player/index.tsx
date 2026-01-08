'use client';

import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { Sender } from '@/types/playthrough';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import PlayerInput from './PlayerInput';

export default function Player({
  header,
  className,
}: {
  header?: React.ReactNode;
  className?: string;
}) {
  const { lines, status, handleSubmit, handleRestart } = usePlayerContext();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function renderStatus() {
    switch (status) {
      case Status.WAITING:
        return <PlayerInput handleSubmit={handleSubmit} />;
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
    <div className="flex flex-col h-full">
      <div className="space-y-2 py-2 flex flex-col relative justify-between h-full">
        {header}
        <div className="flex flex-col gap-2 pb-15 h-full overflow-scroll flex-1">
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
                  <img src={line.text} alt="" className="max-w-full max-h-40 rounded" />
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
          {status !== Status.WAITING && (
            <p className="italic text-neutral-400">({status.toLowerCase()}...)</p>
          )}
          <div ref={endRef} />
        </div>

        <motion.div
          id={lines.length.toString()}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={twMerge('w-full absolute bottom-0', className)}
        >
          {renderStatus()}
        </motion.div>
      </div>
    </div>
  );
}
