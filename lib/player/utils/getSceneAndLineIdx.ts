import { Line } from '@/types/playthrough';

/**
 * When starting a playthrough, find where the
 * current SCENE and LINE IDX are
 * to initialize the game state and continue from the right place.
 */
export function getSceneAndLineIdx({
  lines,
  sceneMap,
}: {
  lines: Line[];
  sceneMap: Record<string, number>;
}) {
  // Find the first line with a valid ID (not player lines)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.id.match(/^(.+)-(\d+)$/);
    if (match) {
      const scene = match[1];
      const idx = parseInt(match[2], 10);

      // Verify the scene exists in sceneMap
      if (sceneMap[scene] === undefined) {
        console.log(`Scene ${scene} not found in sceneMap`);
      } else {
        return { currentSceneId: scene, currentLineIdx: idx + 1 };
      }
    }
  }

  return { currentSceneId: 'START', currentLineIdx: 0 };
}
