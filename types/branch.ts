/**
 * Types for branch tracking.
 * A branch captures one AI generation event for author review.
 * Tracks at scene level, not individual lines.
 */

import { SchemaEntry } from './schema';

export type SceneId = string;
export type Scene = SchemaEntry[]; // scene content after # SCENEID

export interface Branch {
  id: string;
  title: string;
  playthroughId: string;

  // Track entire scenes, not individual lines
  sceneIds: string[]; // ["FIRE", "BIKE"]
  base: Map<SceneId, Scene>; // scene snapshotted before generation
  generated: Map<SceneId, Scene>; // AI generated off of base
  authored?: Map<SceneId, Scene>; // author's edits (captured on closure)
  approved?: boolean; // true = approved, false = rejected, undefined = unresolved
  createdAt: Date;
}
