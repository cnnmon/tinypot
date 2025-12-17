'use client';

import { createContext, ReactNode, useContext, useState } from 'react';

interface GameContextType {
  lines: string[];
  setLines: React.Dispatch<React.SetStateAction<string[]>>;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState(['The fire burns brightly.', 'goto FIRE']);

  return <GameContext.Provider value={{ lines, setLines }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
