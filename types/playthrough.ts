import { Id } from '@/convex/_generated/dataModel';
import { Entity } from './entities';

/**
 * Each LINE is ID'd by SCENE-lineIdx underneath the #SCENE-NAME.
 * This will help us figure out where to continue the story
 * without keeping a currentLineIdx elsewhere.
 */
export interface Line {
  id: `${string}-${number}`; // SCENE-lineIdx
  sender: Entity.AUTHOR | Entity.SYSTEM | Entity.PLAYER;
  text: string; // content
  metadata?: {
    imageUrl?: string;
  };
}

export interface Playthrough {
  id: Id<'playthroughs'>;
  projectId: string;
  lines: Line[];
  createdAt: number; // timestamp
  versionId: Id<'versions'>;
}
