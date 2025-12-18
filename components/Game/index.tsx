'use client';

import { useProject } from '@/lib/project';
import { GameStatus } from '@/types/games';
import History from './History';

export default function Player() {
  const { gameState, selectOption, restart } = useProject();
  const { currentOptions, status } = gameState;

  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto">
        <History />
      </div>

      {/* Footer */}
      <div className="shrink-0 w-full space-y-2 p-2 bg-white bordered-top">
        {/* Options */}
        {currentOptions.map((option, i) => (
          <button key={i} onClick={() => selectOption(option)}>
            {option.text}
          </button>
        ))}

        {/* End state */}
        {status === GameStatus.ENDED && (
          <div className="flex flex-col items-center justify-center">
            <button onClick={restart}>Restart?</button>
          </div>
        )}
      </div>
    </>
  );
}
