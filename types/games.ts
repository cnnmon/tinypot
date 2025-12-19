import { Playthrough, PlaythroughEntry } from './playthroughs';
import { OptionLine, Schema } from './schema';
import { Branch } from './versions';

export type Game = {
  id: string;
  authorId: string;
  name: string;
  description: string;
  lines: string[]; // Raw editor text (source of truth)
  schema: Schema; // Parsed version (derived from lines)
  branches: Branch[];
  playthroughs: Playthrough[];
};

export enum GameStatus {
  RUNNING = 'running',
  WAITING = 'waiting',
  ENDED = 'ended',
}

/** Represents the current UI state during gameplay */
export interface GameState {
  history: PlaythroughEntry[];
  currentLineIdx: number;
  status: 'running' | 'waiting' | 'ended';
  animatedCount: number;

  // Options
  currentOptions: OptionLine[];
  consumedOptions: string[];
}
