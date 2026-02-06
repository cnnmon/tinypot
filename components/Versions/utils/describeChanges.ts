import { getSceneNames } from './getSceneNames';

/** Describe what changed between two snapshots */
export function describeChanges(
  current: { script: string[]; guidebook: string },
  previous: { script: string[]; guidebook: string } | null,
): string {
  if (!previous) {
    const scenes = getSceneNames(current.script);
    if (scenes.size === 0) return 'START';
    return `added ${Array.from(scenes).slice(0, 2).join(', ')}`;
  }

  const currentScenes = getSceneNames(current.script);
  const previousScenes = getSceneNames(previous.script);

  // Find added scenes
  const added: string[] = [];
  for (const scene of currentScenes) {
    if (!previousScenes.has(scene)) {
      added.push(scene);
    }
  }

  // Find edited scenes (scenes that exist in both but have different content)
  const edited: string[] = [];
  for (const scene of currentScenes) {
    if (previousScenes.has(scene)) {
      // Simple check: if overall script changed and scene exists in both, it might be edited
      if (current.script.join('\n') !== previous.script.join('\n')) {
        edited.push(scene);
      }
    }
  }

  // Build description
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`+${added.slice(0, 2).join(', ')}`);
  }
  if (edited.length > 0 && added.length === 0) {
    // Only show edited if nothing was added (to keep it short)
    parts.push(`~${edited.slice(0, 1).join(', ')}`);
  }

  // If no scenes found but content changed, refer to START
  if (parts.length === 0 && currentScenes.size === 0) {
    return '~START';
  }

  return parts.length > 0 ? parts.join(' ') : 'edited';
}
