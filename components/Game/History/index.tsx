'use client';

import { useProject } from '@/lib/project';
import { GameStatus } from '@/types/games';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

const DEFAULT_STAGGER_MS = 150;
const DEFAULT_DURATION_MS = 300;

export default function History() {
  const { gameState, onAnimationComplete, jumpToChoice } = useProject();
  const { history, status, animatedCount } = gameState;
  const endRef = useRef<HTMLDivElement>(null);

  const [timing, setTiming] = useState({
    stagger: DEFAULT_STAGGER_MS,
    duration: DEFAULT_DURATION_MS,
  });

  useEffect(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const stagger =
      parseFloat(styles.getPropertyValue('--animation-stagger')) || DEFAULT_STAGGER_MS;
    const duration =
      parseFloat(styles.getPropertyValue('--animation-duration')) * 1000 || DEFAULT_DURATION_MS;
    setTiming({ stagger, duration });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    const newCount = history.length - animatedCount;
    if (newCount > 0) {
      const totalDelay = newCount * timing.stagger + timing.duration;
      const timer = setTimeout(onAnimationComplete, totalDelay);
      return () => clearTimeout(timer);
    }
  }, [history.length, animatedCount, onAnimationComplete, timing]);

  const handleChoiceClick = (index: number) => {
    if (confirm('Are you sure you want to jump to this choice?')) {
      jumpToChoice(index);
    }
  };

  return (
    <div className="space-y-2 h-inherit">
      {history.map((entry, i) => {
        const isNew = i >= animatedCount;
        const delay = isNew ? (i - animatedCount) * timing.stagger : 0;
        const isChoice = 'isChoice' in entry && entry.isChoice && entry.text;

        if (isChoice) {
          return (
            <div key={i}>
              <p
                className={twMerge(
                  'cursor-pointer hover:bg-mint/50 px-1 -mx-1 transition-colors',
                  isNew ? 'history-entry-new opacity-0' : ''
                )}
                style={isNew ? { animationDelay: `${delay}ms` } : undefined}
                onClick={() => handleChoiceClick(i)}
              >
                <span className="text-gray-500">&gt; </span>
                {entry.text}
              </p>
            </div>
          );
        }

        return (
          <p
            key={i}
            className={isNew ? 'history-entry-new opacity-0' : ''}
            style={isNew ? { animationDelay: `${delay}ms` } : undefined}
          >
            {'text' in entry ? entry.text : entry.input}
          </p>
        );
      })}
      {status === GameStatus.ENDED && (
        <p
          className={history.length > animatedCount ? 'history-entry-new opacity-0' : ''}
          style={
            history.length > animatedCount
              ? { animationDelay: `${(history.length - animatedCount) * timing.stagger}ms` }
              : undefined
          }
        >
          END.
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}
