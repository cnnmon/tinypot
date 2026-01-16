import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export default function PlayerInput({
  handleSubmit,
}: {
  handleSubmit: (input: string) => void | Promise<void>;
}) {
  const { status, handleJumpBack, handleRestart } = usePlayerContext();
  const [input, setInput] = useState<string>('');
  const isSubmitting = status === Status.MATCHING;
  const inputRef = useRef<HTMLInputElement>(null);
  const isDisabled = isSubmitting || status !== Status.WAITING;

  useEffect(() => {
    if (!isDisabled) {
      inputRef.current?.focus();
    }
  }, [isDisabled]);

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
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`What do you want to do?`}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          disabled={isDisabled}
          className="pb-10!"
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
        <button onClick={handleRestart}>Restart</button>
        <button onClick={handleJumpBack}>Undo</button>
        <button onClick={() => handleSubmit('')}>Skip</button>
      </div>
    </div>
  );
}
