/**
 * Playthroughs are resulting play experiences, which optionally generate branches.
 * These branches will persist to the player as changes to the current game's schema.
 * Later, the author may view branches that spawned from the playthrough.
 */

import { Schema } from './schema';

export interface TextEntry {
  text: string;
}

export interface InputEntry {
  input: string;
}

export type PlaythroughEntry = TextEntry | InputEntry;

export interface Playthrough {
  id: string;
  schema: Schema; // May be modified through real-time generation
  history: PlaythroughEntry[]; // Log of visible lines to the player in the game
  branchIds?: string[]; // Keeps track of potential branch ids that spawned
}
