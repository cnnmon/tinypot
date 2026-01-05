import usePlayer, { Status } from '@/lib/player';
import { useState } from 'react';

export default function PlayerInput({
  handleSubmit,
}: {
  handleSubmit: (input: string) => void | Promise<void>;
}) {
  const { status } = usePlayer();
  const [input, setInput] = useState<string>('');
  const isSubmitting = status === Status.MATCHING;

  const onSubmit = async () => {
    if (input.length === 0 || isSubmitting) return;
    await handleSubmit(input);
    setInput('');
  };

  return (
    <div className="relative">
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What do you want to do?"
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        disabled={isSubmitting}
        className="pb-10! bordered"
      />
      <button
        disabled={input.length === 0 || isSubmitting}
        className="absolute bottom-0 right-0 pr-2 pb-1 bg-transparent!"
        onClick={onSubmit}
      >
        {isSubmitting ? '...' : 'Submit'}
      </button>
    </div>
  );
}
