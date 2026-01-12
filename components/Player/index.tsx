'use client';

import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { Sender } from '@/types/playthrough';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import PlayerInput from './PlayerInput';

export default function Player() {
  const { lines, status, handleSubmit, currentSceneId, variables } = usePlayerContext();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(atBottom);
    }
  };

  return (
    <>
      {/* State */}
      <div
        className={twMerge(
          'absolute top-0 right-0 z-[1] flex justify-end flex-col w-full border-2 p-2 bg-white transition-opacity duration-200',
          isAtBottom ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p>
          Currently in scene <span className="font-bold">{currentSceneId}</span>.
          {variables.length > 0 && (
            <>
              {' '}
              You have: <span className="font-bold">{variables.join(', ')}</span>
            </>
          )}
        </p>
      </div>

      {/* Lines */}
      <div className="space-y-2 flex flex-col relative justify-between h-full">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex flex-col gap-2 h-full overflow-scroll pb-20 pt-20"
        >
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
                  <img
                    src={line.text}
                    alt=""
                    className="max-w-full max-h-40 rounded"
                    onLoad={() => endRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  />
                </motion.div>
              );
            }

            return (
              <motion.p
                key={i}
                className={twMerge(
                  line.sender === Sender.SYSTEM && 'italic text-neutral-400 text-sm',
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
          {status !== Status.WAITING &&
            (status === Status.ENDED ? (
              <p>END.</p>
            ) : (
              <p className="italic text-neutral-400">({status.toLowerCase()}...)</p>
            ))}
          <div ref={endRef} />
        </div>
      </div>

      <motion.div
        id={lines.length.toString()}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={twMerge('w-full absolute bottom-0')}
      >
        <PlayerInput handleSubmit={handleSubmit} />
      </motion.div>
    </>
  );
}
