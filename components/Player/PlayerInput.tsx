import { useState } from 'react';

export default function PlayerInput({ handleSubmit }: { handleSubmit: (input: string) => void }) {
  const [input, setInput] = useState<string>('');
  return (
    <>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What do you want to do?"
      />
      <button disabled={input.length === 0} onClick={() => handleSubmit(input)}>
        next
      </button>
    </>
  );
}
