'use client';

import { useProject } from '@/lib/project';
import { GameStatus } from '@/types/games';
import { twMerge } from 'tailwind-merge';
import Button from '../Button';
import History from './History';

export default function Player() {
  const { gameState, selectOption, fullRestart } = useProject();
  const { currentOptions, status, history, animatedCount, consumedOptions } = gameState;

  const isAnimating = history.length > animatedCount;
  const isWaiting = status === GameStatus.WAITING;

  const handleOptionClick = (option: (typeof currentOptions)[0]) => {
    const isConsumed = consumedOptions.includes(option.text);
    if (!isConsumed) {
      selectOption(option);
    }
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto">
        <History />
      </div>

      {/* Footer */}
      <div className="shrink-0 w-full space-y-2 p-2 bg-white bordered-top">
        {/* Options */}
        {status !== GameStatus.ENDED &&
          currentOptions.map((option, i) => {
            const isConsumed = consumedOptions.includes(option.text);
            const isDisabled = isAnimating || !isWaiting || isConsumed;

            return (
              <Button
                key={i}
                onClick={() => handleOptionClick(option)}
                className={twMerge('w-full', isDisabled && 'opacity-60 pointer-events-none')}
                disabled={isDisabled}
              >
                {option.text}
              </Button>
            );
          })}

        {/* End state - click on choices in history to jump back, or start over */}
        {status === GameStatus.ENDED && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-500">Click on a choice above to jump back</p>
            <Button onClick={fullRestart} disabled={isAnimating}>
              Start over
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
