/**
 * Mock database operations for Games using localStorage.
 * Replace with actual API calls when ready.
 */

import { Game } from '@/types/games';
import { Schema } from '@/types/schema';

const GAMES_KEY = 'bonsai_games';

function getGamesFromStorage(): Game[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(GAMES_KEY);
  return data ? JSON.parse(data) : [];
}

function saveGamesToStorage(games: Game[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export async function getGame(gameId: string): Promise<Game | null> {
  const games = getGamesFromStorage();
  return games.find((g) => g.id === gameId) || null;
}

export async function getOrCreateGame(
  gameId: string,
  defaults: { name: string; description: string; authorId: string; lines: string[]; schema: Schema }
): Promise<Game> {
  const existing = await getGame(gameId);
  if (existing) return existing;

  const games = getGamesFromStorage();
  const newGame: Game = {
    id: gameId,
    authorId: defaults.authorId,
    name: defaults.name,
    description: defaults.description,
    lines: defaults.lines,
    schema: defaults.schema,
    branches: [],
    playthroughs: [],
  };
  games.push(newGame);
  saveGamesToStorage(games);
  return newGame;
}

export async function getAllGames(): Promise<Game[]> {
  return getGamesFromStorage();
}

export async function createGame(
  name: string,
  description: string,
  authorId: string,
  lines: string[] = [],
  schema: Schema = []
): Promise<Game> {
  const games = getGamesFromStorage();
  const newGame: Game = {
    id: crypto.randomUUID(),
    authorId,
    name,
    description,
    lines,
    schema,
    branches: [],
    playthroughs: [],
  };
  games.push(newGame);
  saveGamesToStorage(games);
  return newGame;
}

export async function updateGame(gameId: string, updates: Partial<Game>): Promise<Game | null> {
  const games = getGamesFromStorage();
  const idx = games.findIndex((g) => g.id === gameId);
  if (idx === -1) return null;
  games[idx] = { ...games[idx], ...updates };
  saveGamesToStorage(games);
  return games[idx];
}

export async function deleteGame(gameId: string): Promise<boolean> {
  const games = getGamesFromStorage();
  const filtered = games.filter((g) => g.id !== gameId);
  if (filtered.length === games.length) return false;
  saveGamesToStorage(filtered);
  return true;
}
