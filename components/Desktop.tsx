'use client';

import { createGame, getAllGames } from '@/lib/db';
import { ProjectProvider } from '@/lib/project';
import { Game } from '@/types/games';
import { useCallback, useEffect, useState } from 'react';
import Browser from './Browser';
import Editor from './Editor';
import Player from './Game';
import GameIcon, { NewGameIcon } from './GameIcon';

interface OpenWindow {
  gameId: string;
  minimized: boolean;
}

export default function Desktop() {
  const [games, setGames] = useState<Game[]>([]);
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [focusedWindow, setFocusedWindow] = useState<string | null>(null);

  // Load games from localStorage
  useEffect(() => {
    getAllGames().then(setGames);
  }, []);

  const openGame = useCallback((gameId: string) => {
    setOpenWindows((prev) => {
      const existing = prev.find((w) => w.gameId === gameId);
      if (existing) {
        // Unminimize if minimized
        return prev.map((w) => (w.gameId === gameId ? { ...w, minimized: false } : w));
      }
      return [...prev, { gameId, minimized: false }];
    });
    setFocusedWindow(gameId);
  }, []);

  const closeWindow = useCallback((gameId: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.gameId !== gameId));
    setFocusedWindow((prev) => (prev === gameId ? null : prev));
  }, []);

  const minimizeWindow = useCallback((gameId: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.gameId === gameId ? { ...w, minimized: true } : w))
    );
  }, []);

  const handleCreateGame = useCallback(async () => {
    const name = prompt('Enter game name:');
    if (!name) return;

    const newGame = await createGame(name, '', 'local', [], []);
    setGames((prev) => [...prev, newGame]);
    openGame(newGame.id);
  }, [openGame]);

  const focusWindow = useCallback((gameId: string) => {
    setFocusedWindow(gameId);
    // Unminimize if clicking on minimized window
    setOpenWindows((prev) =>
      prev.map((w) => (w.gameId === gameId ? { ...w, minimized: false } : w))
    );
  }, []);

  // Get z-index based on focus order
  const getZIndex = (gameId: string) => {
    if (focusedWindow === gameId) return 100;
    const idx = openWindows.findIndex((w) => w.gameId === gameId);
    return 10 + idx;
  };

  return (
    <div className="min-h-screen p-6 relative">
      {/* Animated dots background */}
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

      {/* Desktop icons */}
      <div className="flex flex-wrap gap-2 content-start mb-4">
        {games.map((game) => (
          <GameIcon
            key={game.id}
            game={game}
            onClick={() => openGame(game.id)}
            isOpen={openWindows.some((w) => w.gameId === game.id)}
          />
        ))}
        <NewGameIcon onClick={handleCreateGame} />
      </div>

      {/* Open windows */}
      {openWindows.map((window) => {
        const game = games.find((g) => g.id === window.gameId);
        if (!game || window.minimized) return null;

        return (
          <div
            key={game.id}
            className="absolute inset-6"
            style={{ zIndex: getZIndex(game.id) }}
            onClick={() => focusWindow(game.id)}
          >
            <ProjectProvider projectId={game.id}>
              <Browser
                title={game.name}
                onClose={() => closeWindow(game.id)}
                onMinimize={() => minimizeWindow(game.id)}
              >
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
            </ProjectProvider>
          </div>
        );
      })}

      {/* Taskbar for minimized windows */}
      {openWindows.some((w) => w.minimized) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur bordered-top p-2 flex gap-2 z-[200]">
          {openWindows
            .filter((w) => w.minimized)
            .map((window) => {
              const game = games.find((g) => g.id === window.gameId);
              if (!game) return null;

              return (
                <button
                  key={game.id}
                  onClick={() => focusWindow(game.id)}
                  className="px-4 py-2 bordered bg-white hover:bg-lime transition-colors text-sm font-medium"
                >
                  🌱 {game.name}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

