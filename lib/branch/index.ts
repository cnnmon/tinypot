/**
 * Branch utilities for scene-level tracking.
 * Branches capture AI generation events for author review.
 */

import { Branch, Scene, SceneId } from '@/types/branch';
import { EntryType, Schema, SchemaEntry } from '@/types/schema';

// Re-export types for convenience
export type { Scene, SceneId } from '@/types/branch';

export type BranchStatus = 'Approved' | 'Edited' | 'Rejected' | 'Unresolved';

/**
 * Deep compare two scenes for equality.
 */
export function scenesEqual(a: Scene, b: Scene): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Deep compare two Records of scenes.
 */
function recordsEqual(a: Record<SceneId, Scene>, b: Record<SceneId, Scene>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!b[key] || !scenesEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Compute branch status by comparing base, generated, and authored scenes.
 */
export function getBranchStatus(branch: Branch): BranchStatus {
  if (branch.approved === true) return 'Approved';
  if (branch.approved === false) return 'Rejected';
  if (!branch.authored) return 'Unresolved';
  if (recordsEqual(branch.authored, branch.generated)) return 'Approved';
  if (recordsEqual(branch.authored, branch.base)) return 'Rejected';
  return 'Edited';
}

/**
 * Check if branch is resolved (approved or rejected).
 */
export function isResolved(branch: Branch): boolean {
  return branch.approved !== undefined;
}

/**
 * Get list of affected scene IDs from a branch.
 */
export function getAffectedSceneIds(branch: Branch): string[] {
  return branch.sceneIds;
}

/**
 * Deep clone a scene.
 */
export function cloneScene(scene: Scene): Scene {
  return JSON.parse(JSON.stringify(scene));
}

/**
 * Flatten entries recursively - includes nested `then` block contents.
 * This matches what appears in the editor as separate lines.
 */
export function flattenEntries(entries: SchemaEntry[]): SchemaEntry[] {
  const result: SchemaEntry[] = [];

  for (const entry of entries) {
    result.push(entry);
    if (entry.type === EntryType.OPTION && entry.then) {
      result.push(...flattenEntries(entry.then));
    }
  }

  return result;
}

/**
 * Extract scenes from a schema as a Record.
 * Returns Record<SceneId, Scene> where Scene includes flattened entries (including nested then blocks).
 * Content before the first scene marker is assigned to "START".
 */
export function extractScenesFromSchema(schema: Schema): Record<SceneId, Scene> {
  const scenes: Record<SceneId, Scene> = {};
  let currentSceneId: string = 'START'; // Default to START for content before first scene
  let currentScene: Scene = [];

  for (const entry of schema) {
    if (entry.type === EntryType.SCENE) {
      // Save previous scene (flattened) if it has content
      if (currentScene.length > 0) {
        scenes[currentSceneId] = flattenEntries(currentScene);
      }
      // Start new scene
      currentSceneId = entry.label;
      currentScene = [];
    } else {
      currentScene.push(entry);
    }
  }

  // Save last scene (flattened) if it has content
  if (currentScene.length > 0) {
    scenes[currentSceneId] = flattenEntries(currentScene);
  }

  return scenes;
}

/**
 * Generate automatic branch title from affected scene IDs.
 */
export function generateBranchTitle(sceneIds: string[]): string {
  if (sceneIds.length === 0) return 'Empty branch';
  if (sceneIds.length === 1) return `Edited ${sceneIds[0]}`;
  if (sceneIds.length <= 3) return `Edited ${sceneIds.join(', ')}`;
  return `Edited ${sceneIds.slice(0, 2).join(', ')} +${sceneIds.length - 2} more`;
}

/**
 * Compute diff between two schemas and return the changed scenes.
 */
function computeSchemaDiff(
  baseSchema: Schema,
  generatedSchema: Schema,
): {
  base: Record<SceneId, Scene>;
  generated: Record<SceneId, Scene>;
  affectedSceneIds: string[];
} {
  const baseScenes = extractScenesFromSchema(baseSchema);
  const generatedScenes = extractScenesFromSchema(generatedSchema);

  const base: Record<SceneId, Scene> = {};
  const generated: Record<SceneId, Scene> = {};
  const affectedSceneIds: string[] = [];

  // Check all scenes in generated schema
  for (const sceneId of Object.keys(generatedScenes)) {
    const genScene = generatedScenes[sceneId];
    const baseScene = baseScenes[sceneId];

    if (!baseScene) {
      // New scene - didn't exist in base
      affectedSceneIds.push(sceneId);
      base[sceneId] = [];
      generated[sceneId] = cloneScene(genScene);
    } else if (!scenesEqual(baseScene, genScene)) {
      // Modified scene
      affectedSceneIds.push(sceneId);
      base[sceneId] = cloneScene(baseScene);
      generated[sceneId] = cloneScene(genScene);
    }
  }

  // Check for deleted scenes (in base but not in generated)
  for (const sceneId of Object.keys(baseScenes)) {
    if (!generatedScenes[sceneId]) {
      affectedSceneIds.push(sceneId);
      base[sceneId] = cloneScene(baseScenes[sceneId]);
      generated[sceneId] = [];
    }
  }

  return { base, generated, affectedSceneIds };
}

/**
 * Create a branch by comparing base and generated schemas.
 * Only stores scenes that changed.
 */
export function createBranch(
  playthroughId: string,
  baseSchema: Schema,
  generatedSchema: Schema,
  baseScript: string[],
): Branch {
  const { base, generated, affectedSceneIds } = computeSchemaDiff(baseSchema, generatedSchema);

  return {
    id: crypto.randomUUID(),
    title: generateBranchTitle(affectedSceneIds),
    playthroughId,
    sceneIds: affectedSceneIds,
    base,
    generated,
    baseScript,
    createdAt: Date.now(),
  };
}

/**
 * Merge new changes into an existing branch.
 * Uses the CURRENT state (before this generation) as the new base,
 * so only the latest changes are highlighted as "new".
 */
export function mergeBranchChanges(
  existingBranch: Branch,
  baseSchema: Schema,
  generatedSchema: Schema,
): Branch {
  const {
    base: newBase,
    generated: newGenerated,
    affectedSceneIds: newAffectedIds,
  } = computeSchemaDiff(baseSchema, generatedSchema);

  // Use the new base for all scenes - this represents the state BEFORE this generation
  // This ensures only the LATEST changes are highlighted as yellow
  const updatedBase = { ...newBase };
  const updatedGenerated = { ...newGenerated };
  const updatedSceneIds = [...newAffectedIds];

  // Keep track of scenes that were in the previous branch but not affected by this merge
  // (These are resolved/unchanged scenes from previous generations)
  for (const sceneId of existingBranch.sceneIds) {
    if (!updatedSceneIds.includes(sceneId)) {
      // Scene was in previous branch but not changed in this generation
      // Keep the previous generated state as both base and generated (no diff)
      if (existingBranch.generated[sceneId]) {
        updatedBase[sceneId] = existingBranch.generated[sceneId];
        updatedGenerated[sceneId] = existingBranch.generated[sceneId];
        updatedSceneIds.push(sceneId);
      }
    }
  }

  return {
    ...existingBranch,
    title: generateBranchTitle(newAffectedIds), // Title reflects only NEW changes
    sceneIds: updatedSceneIds,
    base: updatedBase,
    generated: updatedGenerated,
  };
}

/**
 * Detect stale scenes - scenes referenced in branch that no longer exist in current schema.
 */
export function getStaleScenes(branch: Branch, currentSchema: Schema): string[] {
  const currentScenes = extractScenesFromSchema(currentSchema);
  return branch.sceneIds.filter((sceneId) => !currentScenes[sceneId]);
}

/**
 * Compute scene-to-branch mapping for editor highlighting.
 * Returns Record<SceneId, BranchId> for quick lookup.
 */
export function computeSceneToBranchMap(unresolvedBranches: Branch[]): Record<SceneId, string> {
  const map: Record<SceneId, string> = {};

  for (const branch of unresolvedBranches) {
    for (const sceneId of branch.sceneIds) {
      map[sceneId] = branch.id;
    }
  }

  return map;
}

/**
 * Capture current scene states from schema for branch closure.
 */
export function captureAuthoredScenes(
  branch: Branch,
  currentSchema: Schema,
): Record<SceneId, Scene> {
  const currentScenes = extractScenesFromSchema(currentSchema);
  const authored: Record<SceneId, Scene> = {};

  for (const sceneId of branch.sceneIds) {
    const scene = currentScenes[sceneId];
    authored[sceneId] = scene ? cloneScene(scene) : [];
  }

  return authored;
}
