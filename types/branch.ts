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
  createdAt: number; // timestamp

  // Track entire scenes, not individual lines
  sceneIds: string[]; // ["FIRE", "BIKE"]
  base: Record<SceneId, Scene>; // scene snapshotted before generation
  generated: Record<SceneId, Scene>; // AI generated off of base
  authored?: Record<SceneId, Scene>; // author's edits (captured on closure)

  // Full script backup for easy revert (optional for backwards compat with old branches)
  baseScript?: string[]; // original script before any generation

  // After resolution
  approved?: boolean; // true = approved, false = rejected, undefined = unresolved
  metalearning?: string; // metalearning notes
}
