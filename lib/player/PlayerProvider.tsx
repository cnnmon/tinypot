'use client';

import { createContext, useContext, ReactNode } from 'react';
import usePlayerInternal, { Status } from './index';

type PlayerContextType = ReturnType<typeof usePlayerInternal>;

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = usePlayerInternal();
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext must be used within a PlayerProvider');
  }
  return context;
}

export { Status };
