import { Playthrough } from './playthroughs';
import { Schema } from './schema';
import { Branch } from './versions';

export type Game = {
  id: string;
  authorId: string;
  name: string;
  description: string;
  schema: Schema;
  branches: Branch[];
  playthroughs: Playthrough[];
};
