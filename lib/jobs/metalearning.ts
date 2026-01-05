/**
 * Metalearning job - analyzes author changes to infer preferences.
 */

import { MetalearningRequest, MetalearningResponse } from '@/app/api/metalearning/route';
import { Branch, Scene, SceneId } from '@/types/branch';

export interface MetalearningResult {
  branchId: string;
  updatedGuidebook: string;
  newRule: string | null;
}

/**
 * Format scenes for the API.
 */
function formatScenes(scenes: Record<SceneId, Scene>): string {
  const parts: string[] = [];
  for (const sceneId of Object.keys(scenes)) {
    const scene = scenes[sceneId];
    const content = scene.map((e) => JSON.stringify(e)).join('\n');
    parts.push(`[Scene: ${sceneId}]\n${content}`);
  }
  return parts.join('\n\n');
}

/**
 * Call the metalearning API to analyze author changes.
 */
async function analyzeChanges(
  branch: Branch,
  existingGuidebook: string,
): Promise<{ updatedGuidebook: string; newRule: string | null }> {
  const generated = formatScenes(branch.generated);
  const authored = branch.authored ? formatScenes(branch.authored) : generated;

  const response = await fetch('/api/metalearning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generated,
      authored,
      approved: branch.approved ?? false,
      existingGuidebook,
    } satisfies MetalearningRequest),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze changes');
  }

  const data: MetalearningResponse = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Metalearning failed');
  }

  return {
    updatedGuidebook: data.updatedGuidebook || existingGuidebook,
    newRule: data.newRule,
  };
}

/**
 * Run metalearning for a resolved branch.
 * Returns the updated guidebook and the new/updated rule.
 */
export async function runMetalearning(
  branchId: string,
  branch: Branch,
  existingGuidebook: string,
): Promise<MetalearningResult> {
  const { updatedGuidebook, newRule } = await analyzeChanges(branch, existingGuidebook);

  return {
    branchId,
    updatedGuidebook,
    newRule,
  };
}
