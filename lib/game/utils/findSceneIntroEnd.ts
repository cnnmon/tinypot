import { LineType, Schema } from '@/types/schema';

/**
 * Finds where the scene intro ends (index of first OPTION in the scene).
 * Returns the count of narrative entries before the first options.
 */
export function findSceneIntroEnd(schema: Schema, sceneStart: number = 0): number {
  let narrativeCount = 0;
  for (let i = sceneStart; i < schema.length; i++) {
    const line = schema[i];
    if (line.type === LineType.OPTION) {
      return narrativeCount;
    }
    if (line.type === LineType.NARRATIVE) {
      narrativeCount++;
    }
  }
  return narrativeCount;
}

