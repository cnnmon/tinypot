'use client';

import Header from '@/components/Header';
import { useTooltipTrigger } from '@/components/TooltipProvider';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider, Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { ProjectProvider } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import { Sender } from '@/types/playthrough';
import { ArrowLeftIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { motion } from 'motion/react';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export default function PlayPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const projectId = decodeShareId(shareId);

  if (!projectId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f0f7f0] to-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl text-neutral-600 font-light">Story not found</h1>
          <p className="text-neutral-400">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={projectId as Id<'projects'>}>
      <PlayerProvider>
        <PlayContent />
      </PlayerProvider>
    </ProjectProvider>
  );
}

function PlayContent() {
  const { lines, status, handleSubmit, handleJumpBack, handleRestart } = usePlayerContext();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const isSubmitting = status === Status.MATCHING || status === Status.GENERATING;

  const jumpBackTooltip = useTooltipTrigger('Undo last action');
  const restartTooltip = useTooltipTrigger('Start over');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const onSubmit = async () => {
    if (input.length === 0 || isSubmitting) return;
    await handleSubmit(input);
    setInput('');
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-[#f0f7f0] to-white">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Header />
      </div>

      {/* Story area */}
      <div className="flex-1 overflow-hidden flex justify-center">
        <div className="w-full max-w-2xl flex flex-col">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4">
            {lines.map((line, i) => {
              const isPlayer = line.sender === Sender.PLAYER;
              const isSystem = line.sender === Sender.SYSTEM;
              const isImage = line.type === 'image';

              if (isImage) {
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="my-6"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.text}
                      alt=""
                      className="max-w-full max-h-64 rounded-lg shadow-md mx-auto"
                    />
                  </motion.div>
                );
              }

              if (isPlayer) {
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex justify-end"
                  >
                    <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl rounded-br-sm max-w-[80%]">
                      {line.text}
                    </div>
                  </motion.div>
                );
              }

              if (isSystem) {
                return (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-neutral-400 text-sm italic text-center"
                  >
                    {line.text}
                  </motion.p>
                );
              }

              return (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-neutral-700 leading-relaxed"
                >
                  {line.text}
                </motion.p>
              );
            })}

            {/* Status indicators */}
            {status === Status.ENDED && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <p className="text-neutral-500 text-lg">The End</p>
                <button
                  onClick={handleRestart}
                  className="mt-4 text-emerald-500 hover:text-emerald-600 transition-colors"
                >
                  Play again
                </button>
              </motion.div>
            )}

            {(status === Status.MATCHING || status === Status.GENERATING) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                  <span
                    className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
              </motion.div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input area */}
          {status === Status.WAITING && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 flex w-full justify-between gap-2"
            >
              <div className="relative w-full">
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="What do you do?"
                  onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                  disabled={isSubmitting}
                  className={twMerge(
                    'w-full text-neutral-700 placeholder:text-neutral-400',
                    'px-5 py-4 rounded-xl',
                    'bordered',
                    'shadow-sm transition-colors',
                  )}
                />
                <button
                  onClick={onSubmit}
                  disabled={input.length === 0 || isSubmitting}
                  className={twMerge(
                    'absolute right-1 top-1/2 -translate-y-1/2',
                    'p-2 rounded-lg transition-all bg-transparent!',
                    input.length > 0 ? 'text-emerald-500 hover:bg-emerald-50' : 'text-neutral-300',
                  )}
                >
                  <PaperAirplaneIcon width={20} height={20} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleJumpBack}
                  className="p-2 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                  {...jumpBackTooltip}
                >
                  <ArrowLeftIcon width={15} height={15} />
                </button>
                <button
                  onClick={handleRestart}
                  className="p-2 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                  {...restartTooltip}
                >
                  <ArrowPathIcon width={15} height={15} />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
