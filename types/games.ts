import { Playthrough } from './playthroughs';
import { Schema } from './schema';
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
