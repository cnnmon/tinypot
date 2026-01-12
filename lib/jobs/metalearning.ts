/**
 * Metalearning job - analyzes author changes to infer preferences.
 */

import { MetalearningRequest, MetalearningResponse } from '@/app/api/metalearning/route';
import { Branch, Scene, SceneId } from '@/types/branch';

export interface MetalearningResult {
  branchId: string;
  updatedGuidebook: string;
  newRule: string | null;
  action: 'add' | 'update' | 'none';
  previousRule?: string;
}

/**
 * Format a single entry as human-readable text.
 */
function formatEntry(entry: Scene[number], indent = ''): string {
  switch (entry.type) {
    case 'narrative':
      return `${indent}${entry.text}`;
    case 'scene':
      return `${indent}# ${entry.label}`;
    case 'goto':
      return `${indent}> ${entry.target}`;
    case 'option':
      const optionLine = `${indent}* ${entry.text}`;
      const thenLines = entry.then.map((e) => formatEntry(e, indent + '  ')).join('\n');
      return thenLines ? `${optionLine}\n${thenLines}` : optionLine;
    default:
      return '';
  }
}

/**
 * Format scenes as human-readable script (not JSON).
 */
function formatScenes(scenes: Record<SceneId, Scene>): string {
  const parts: string[] = [];
  for (const sceneId of Object.keys(scenes)) {
    const scene = scenes[sceneId];
    const content = scene.map((e) => formatEntry(e)).filter(Boolean).join('\n');
    parts.push(`# ${sceneId}\n${content}`);
  }
  return parts.join('\n\n');
}

/**
 * Call the metalearning API to analyze author changes.
 */
async function analyzeChanges(
  branch: Branch,
  existingGuidebook: string,
): Promise<{
  updatedGuidebook: string;
  newRule: string | null;
  action: 'add' | 'update' | 'none';
  previousRule?: string;
}> {
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
    action: data.action,
    previousRule: data.previousRule,
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
  const { updatedGuidebook, newRule, action, previousRule } = await analyzeChanges(
    branch,
    existingGuidebook,
  );

  return {
    branchId,
    updatedGuidebook,
    newRule,
    action,
    previousRule,
  };
}
