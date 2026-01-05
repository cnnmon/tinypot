/**
 * Metalearning job - analyzes author changes to infer preferences.
 */

import { MetalearningRequest, MetalearningResponse } from '@/app/api/metalearning/route';
import { updateBranch } from '@/lib/db/branches';
import { Branch, Scene, SceneId } from '@/types/branch';

export interface MetalearningResult {
  branchId: string;
  metalearning: string;
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
async function analyzeChanges(branch: Branch): Promise<string> {
  const generated = formatScenes(branch.generated);
  const authored = branch.authored ? formatScenes(branch.authored) : generated;

  const response = await fetch('/api/metalearning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generated,
      authored,
      approved: branch.approved ?? false,
    } satisfies MetalearningRequest),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze changes');
  }

  const data: MetalearningResponse = await response.json();
  if (!data.success || !data.metalearning) {
    throw new Error(data.error || 'Metalearning failed');
  }

  return data.metalearning;
}

/**
 * Run metalearning for a resolved branch.
 * Saves to branch and returns the metalearning text.
 */
export async function runMetalearning(
  projectId: string,
  branch: Branch,
): Promise<MetalearningResult> {
  const metalearning = await analyzeChanges(branch);
  
  // Save to branch
  updateBranch(projectId, branch.id, { metalearning });
  
  return {
    branchId: branch.id,
    metalearning,
  };
}
