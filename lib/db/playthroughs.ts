/**
 * Mock database operations for Playthroughs using localStorage.
 * Replace with actual API calls when ready.
 */

import { Playthrough } from '@/types/playthroughs';

const PLAYTHROUGHS_KEY = 'bonsai_playthroughs';

function getPlaythroughsFromStorage(): Playthrough[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(PLAYTHROUGHS_KEY);
  return data ? JSON.parse(data) : [];
}

function savePlaythroughsToStorage(playthroughs: Playthrough[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLAYTHROUGHS_KEY, JSON.stringify(playthroughs));
}

export async function getPlaythrough(playthroughId: string): Promise<Playthrough | null> {
  const playthroughs = getPlaythroughsFromStorage();
  return playthroughs.find((p) => p.id === playthroughId) || null;
}

export async function getPlaythroughsForGame(gameId: string): Promise<Playthrough[]> {
  const playthroughs = getPlaythroughsFromStorage();
  return playthroughs.filter((p) => p.gameId === gameId);
}

export async function createPlaythrough(gameId: string): Promise<Playthrough> {
  const playthroughs = getPlaythroughsFromStorage();
  const newPlaythrough: Playthrough = {
    id: crypto.randomUUID(),
    gameId,
    currentLineIdx: 0,
    history: [],
    createdAt: new Date().toISOString(),
  };
  playthroughs.push(newPlaythrough);
  savePlaythroughsToStorage(playthroughs);
  return newPlaythrough;
}

export async function updatePlaythrough(
  playthroughId: string,
  updates: Partial<Playthrough>
): Promise<Playthrough | null> {
  const playthroughs = getPlaythroughsFromStorage();
  const idx = playthroughs.findIndex((p) => p.id === playthroughId);
  if (idx === -1) return null;
  playthroughs[idx] = { ...playthroughs[idx], ...updates };
  savePlaythroughsToStorage(playthroughs);
  return playthroughs[idx];
}

export async function deletePlaythrough(playthroughId: string): Promise<boolean> {
  const playthroughs = getPlaythroughsFromStorage();
  const filtered = playthroughs.filter((p) => p.id !== playthroughId);
  if (filtered.length === playthroughs.length) return false;
  savePlaythroughsToStorage(filtered);
  return true;
}
