'use client';

import { useProject } from '@/lib/project';
import { TextEntry } from '@/types/playthroughs';

export default function Player() {
  const { gameState, selectOption, restart } = useProject();
  const { history, currentOptions, isEnded } = gameState;

  return (
    <div
      className="flex-1 border-t-[2.5px] md:border-t-0 md:border-l-[2.5px] p-6 overflow-auto flex flex-col"
      style={{
        background: 'linear-gradient(180deg, var(--color-lime) 0%, #ffffff 100%)',
      }}
    >
      {/* Narrative history */}
      <div className="flex-1 font-mono space-y-2">
        {history.map((entry, i) => (
          <p key={i}>
            {'text' in entry ? (entry as TextEntry).text : (entry as { input: string }).input}
          </p>
        ))}
      </div>

      {/* Options */}
      <div className="mt-4 space-y-2">
        {currentOptions.map((option, i) => (
          <button
            key={i}
            onClick={() => selectOption(option)}
            className="block w-full text-left px-4 py-2 border-2 border-black rounded hover:bg-black hover:text-white transition-colors font-mono cursor-pointer"
          >
            {option.text}
          </button>
        ))}
      </div>

      {/* End state */}
      {isEnded && <button onClick={restart}>restart?</button>}
    </div>
  );
}
