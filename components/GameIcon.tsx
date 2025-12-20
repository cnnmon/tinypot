'use client';

import { Game } from '@/types/games';

interface GameIconProps {
  game: Game;
  onClick: () => void;
  isOpen?: boolean;
}

export function DesktopIcon({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-2 hover:bg-white transition-colors group w-24"
    >
      {children}
    </button>
  );
}

export default function GameIcon({ game, onClick, isOpen }: GameIconProps) {
  return (
    <DesktopIcon onClick={onClick}>
      {/* Pot icon */}
      <div
        className={`w-16 h-16 rounded-lg bordered flex items-center justify-center text-3xl transition-transform group-hover:scale-105 ${
          isOpen ? 'bg-mint' : 'bg-white'
        }`}
      >
        🌱
      </div>
      <span className="text-sm font-medium text-primary text-center break-words leading-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
        {game.name}
      </span>
    </DesktopIcon>
  );
}

interface NewGameIconProps {
  onClick: () => void;
}

export function NewGameIcon({ onClick }: NewGameIconProps) {
  return (
    <DesktopIcon onClick={onClick}>
      <div className="w-16 h-16 rounded-lg bordered bg-white/50 flex items-center justify-center text-3xl transition-transform group-hover:scale-105 border-dashed!">
        +
      </div>
      <span className="text-sm font-medium text-primary/70 text-center">New Game</span>
    </DesktopIcon>
  );
}
