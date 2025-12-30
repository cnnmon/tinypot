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
 * Deep compare two Maps of scenes.
 */
function mapsEqual(a: Map<SceneId, Scene>, b: Map<SceneId, Scene>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, val] of a) {
    const other = b.get(key);
    if (!other || !scenesEqual(val, other)) return false;
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
  if (mapsEqual(branch.authored, branch.generated)) return 'Approved';
  if (mapsEqual(branch.authored, branch.base)) return 'Rejected';
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
 * Extract scenes from a schema as a Map.
 * Returns Map<SceneId, Scene> where Scene includes flattened entries (including nested then blocks).
 */
export function extractScenesFromSchema(schema: Schema): Map<SceneId, Scene> {
  const scenes = new Map<SceneId, Scene>();
  let currentSceneId: string | null = null;
  let currentScene: Scene = [];

  for (const entry of schema) {
    if (entry.type === EntryType.SCENE) {
      // Save previous scene (flattened)
      if (currentSceneId !== null) {
        scenes.set(currentSceneId, flattenEntries(currentScene));
      }
      // Start new scene
      currentSceneId = entry.label;
      currentScene = [];
    } else if (currentSceneId !== null) {
      currentScene.push(entry);
    }
  }

  // Save last scene (flattened)
  if (currentSceneId !== null) {
    scenes.set(currentSceneId, flattenEntries(currentScene));
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
  base: Map<SceneId, Scene>;
  generated: Map<SceneId, Scene>;
  affectedSceneIds: string[];
} {
  const baseScenes = extractScenesFromSchema(baseSchema);
  const generatedScenes = extractScenesFromSchema(generatedSchema);

  const base = new Map<SceneId, Scene>();
  const generated = new Map<SceneId, Scene>();
  const affectedSceneIds: string[] = [];

  // Check all scenes in generated schema
  for (const [sceneId, genScene] of generatedScenes) {
    const baseScene = baseScenes.get(sceneId);

    if (!baseScene) {
      // New scene - didn't exist in base
      affectedSceneIds.push(sceneId);
      base.set(sceneId, []);
      generated.set(sceneId, cloneScene(genScene));
    } else if (!scenesEqual(baseScene, genScene)) {
      // Modified scene
      affectedSceneIds.push(sceneId);
      base.set(sceneId, cloneScene(baseScene));
      generated.set(sceneId, cloneScene(genScene));
    }
  }

  // Check for deleted scenes (in base but not in generated)
  for (const [sceneId, baseScene] of baseScenes) {
    if (!generatedScenes.has(sceneId)) {
      affectedSceneIds.push(sceneId);
      base.set(sceneId, cloneScene(baseScene));
      generated.set(sceneId, []);
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
): Branch {
  const { base, generated, affectedSceneIds } = computeSchemaDiff(baseSchema, generatedSchema);

  return {
    id: crypto.randomUUID(),
    title: generateBranchTitle(affectedSceneIds),
    playthroughId,
    sceneIds: affectedSceneIds,
    base,
    generated,
    createdAt: new Date(),
  };
}

/**
 * Merge new changes into an existing branch.
 * Updates the generated scenes with new changes while preserving original base.
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

  // Merge into existing branch
  const updatedBase = new Map(existingBranch.base);
  const updatedGenerated = new Map(existingBranch.generated);
  const updatedSceneIds = [...existingBranch.sceneIds];

  for (const sceneId of newAffectedIds) {
    // Only add to base if this scene wasn't already tracked
    if (!updatedBase.has(sceneId)) {
      updatedBase.set(sceneId, newBase.get(sceneId)!);
    }
    // Always update generated to latest
    updatedGenerated.set(sceneId, newGenerated.get(sceneId)!);
    // Add to sceneIds if not already there
    if (!updatedSceneIds.includes(sceneId)) {
      updatedSceneIds.push(sceneId);
    }
  }

  return {
    ...existingBranch,
    title: generateBranchTitle(updatedSceneIds),
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
  return branch.sceneIds.filter((sceneId) => !currentScenes.has(sceneId));
}

/**
 * Compute scene-to-branch mapping for editor highlighting.
 * Returns Map<SceneId, BranchId> for quick lookup.
 */
export function computeSceneToBranchMap(unresolvedBranches: Branch[]): Map<SceneId, string> {
  const map = new Map<SceneId, string>();

  for (const branch of unresolvedBranches) {
    for (const sceneId of branch.sceneIds) {
      map.set(sceneId, branch.id);
    }
  }

  return map;
}

/**
 * Capture current scene states from schema for branch closure.
 */
export function captureAuthoredScenes(branch: Branch, currentSchema: Schema): Map<SceneId, Scene> {
  const currentScenes = extractScenesFromSchema(currentSchema);
  const authored = new Map<SceneId, Scene>();

  for (const sceneId of branch.sceneIds) {
    const scene = currentScenes.get(sceneId);
    authored.set(sceneId, scene ? cloneScene(scene) : []);
  }

  return authored;
}
