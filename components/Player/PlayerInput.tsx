import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { motion } from 'motion/react';
import { useState } from 'react';

export default function PlayerInput({
  handleSubmit,
}: {
  handleSubmit: (input: string) => void | Promise<void>;
}) {
  const { status } = usePlayerContext();
  const [input, setInput] = useState<string>('');
  const isSubmitting = status === Status.MATCHING;

  const onSubmit = async () => {
    if (input.length === 0 || isSubmitting) return;
    await handleSubmit(input);
    setInput('');
  };

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What do you want to do?"
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        disabled={isSubmitting}
        className="pb-10! bordered w-full bg-white"
      />
      <button
        disabled={input.length === 0 || isSubmitting}
        className="absolute bottom-0 right-0 pr-2 pb-1 bg-transparent!"
        onClick={onSubmit}
      >
        {isSubmitting ? '...' : 'Submit'}
      </button>
    </motion.div>
  );
}
