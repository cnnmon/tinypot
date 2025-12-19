/**
 * Playthroughs are resulting play experiences, which optionally generate branches.
 * These branches will persist to the player as changes to the current game's schema.
 * Later, the author may view branches that spawned from the playthrough.
 */

export interface TextEntry {
  text: string;
  liked?: boolean; // Data collection
  isChoice?: boolean; // True if this was a player choice
}

export interface InputEntry {
  input: string;
}

export type PlaythroughEntry = TextEntry | InputEntry;

export interface Playthrough {
  id: string;
  gameId: string;
  currentLineIdx: number; // Current position in schema
  history: PlaythroughEntry[]; // Committed log - does not change on editor updates
  branchId?: string[]; // Branch id
  createdAt: string;
}
