'use client';

import Browser from '@/components/Browser';
import Editor from '@/components/Editor';
import Player from '@/components/Game';

export default function Home() {
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

      <Browser>
        <div className="flex flex-col md:flex-row bg-lime flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-auto flex flex-col">
            <Editor />
          </div>
          <div
            className="flex-1 min-h-0 overflow-auto border-t-[2.5px] md:border-t-0 md:border-l-[2.5px] flex flex-col justify-between"
            style={{
              background: 'linear-gradient(180deg, var(--color-lime) 0%, #ffffff 100%)',
            }}
          >
            <Player />
          </div>
        </div>
      </Browser>
    </div>
  );
}
