/**
 * Types for user playthroughs.
 */

import { Schema } from './schema';

export enum Sender {
  NARRATOR = 'narrator',
  PLAYER = 'player',
  SYSTEM = 'system',
}

/**
 * Each LINE is ID'd by SCENE-lineIdx underneath the #SCENE-NAME.
 * This will help us figure out where to continue the story
 * without keeping a currentLineIdx elsewhere.
 */
export interface Line {
  id: string; // SCENE-lineIdx
  sender: Sender;
  text: string;
}

export interface Playthrough {
  id: string;
  projectId: string;
  lines: Line[];
  createdAt: Date;
  /**
   * When playthrough first starts, snapshot the schema.
   * Do not let any changes pass in for now!
   */
  snapshot: Schema;
}
