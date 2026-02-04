'use client';

import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { Entity } from '@/types/entities';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import PlayerInput from './PlayerInput';

export default function Player() {
  const { lines, status, handleSubmit, currentSceneId, variables } = usePlayerContext();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [lines]);

  return (
    <div className="flex flex-col gap-2 justify-end">
      {/* State */}
      <div className="flex gap-1 justify-end">
        <p>State:</p>
        <p>
          <span className="font-bold">{currentSceneId}</span>
        </p>
        {" / "}
        <p>
          <span className="font-bold">{variables.length > 0 ? variables.join(', ') : 'Empty'}</span>
        </p>
      </div>

      {/* Lines */}
      <div ref={scrollRef} className="flex flex-col gap-2">
        {lines.map((line, i) => {
          if (line.metadata?.imageUrl) {
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img src={line.metadata.imageUrl} alt={line.text} className="max-w-full max-h-40 rounded" />
              </motion.div>
            );
          }

          const isPlayer = line.sender === Entity.PLAYER;
          return (
            <motion.div
              key={i}
              className={twMerge(line.sender === Entity.SYSTEM && 'italic', isPlayer && 'text-[#468D52]')}
              initial={isPlayer ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1, ease: 'easeInOut' }}
            >
              {isPlayer && '> '}
              {line.text}
            </motion.div>
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

      <motion.div id={lines.length.toString()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <PlayerInput handleSubmit={handleSubmit} />
      </motion.div>
    </div>
  );
}
