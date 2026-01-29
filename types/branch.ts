/**
 * Types for branches - AI generation events for author review.
 * Branches track changes at the scene level for diff/approval workflow.
 */

import { SchemaEntry } from './schema';

export type SceneId = string;

/** A scene is an array of schema entries */
export type Scene = SchemaEntry[];

export interface Branch {
  id: string;
  title: string;
  playthroughId: string;
  sceneIds: string[];
  base: Record<SceneId, Scene>;
  generated: Record<SceneId, Scene>;
  authored?: Record<SceneId, Scene>;
  baseScript: string[];
  createdAt: number;
  approved?: boolean;
}
