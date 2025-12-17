'use client';

import Browser from '@/components/Browser';
import Editor from '@/components/Editor';
import Game from '@/components/Game';
import { useGame } from '@/hooks/game';

export default function Home() {
  const { lines } = useGame();

  return (
    <div className="min-h-screen p-6">
      {/* moving dots! */}
      <div
        className="fixed -z-10 pointer-events-none animate-[scroll-dots_2s_linear_infinite]"
        style={{
          backgroundImage: `radial-gradient(circle, white 3px, transparent 1px)`,
          backgroundSize: '15px 15px',
          transform: 'rotate(45deg)',
          inset: '-50%',
          width: '200%',
          height: '200%',
        }}
      />

      <Browser className="flex-col md:flex-row bg-lime">
        <Editor />
        <Game />
      </Browser>
    </div>
  );
}
