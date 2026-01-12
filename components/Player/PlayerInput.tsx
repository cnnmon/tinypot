import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTooltipTrigger } from '../TooltipProvider';

export default function PlayerInput({
  handleSubmit,
}: {
  handleSubmit: (input: string) => void | Promise<void>;
}) {
  const { status, handleJumpBack, handleRestart } = usePlayerContext();
  const [input, setInput] = useState<string>('');
  const isSubmitting = status === Status.MATCHING;

  const jumpBackTooltip = useTooltipTrigger('Undo last action');
  const restartTooltip = useTooltipTrigger('Start over');
  const nextTooltip = useTooltipTrigger('Skip');

  const onSubmit = async () => {
    if (input.length === 0 || isSubmitting) return;
    await handleSubmit(input);
    setInput('');
  };

  return (
    <div className="flex w-full gap-2 pt-2 bg-white items-center justify-center">
      <motion.div
        className="relative w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`What do you want to do?`}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          disabled={isSubmitting || status !== Status.WAITING}
          className="pb-10! bordered w-full bg-white z-[1] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          disabled={input.length === 0 || isSubmitting}
          className="absolute bottom-0 right-0 pr-2 pb-1 bg-transparent! text-sm"
          onClick={onSubmit}
        >
          {isSubmitting ? '...' : 'Submit'}
        </button>
      </motion.div>
      <div className="flex gap-1 flex-col text-sm items-start">
        <button onClick={handleRestart} {...restartTooltip}>
          Restart
        </button>
        <button onClick={handleJumpBack} {...jumpBackTooltip}>
          Undo
        </button>
        <button onClick={() => handleSubmit('')} {...nextTooltip}>
          Skip
        </button>
      </div>
    </div>
  );
}
