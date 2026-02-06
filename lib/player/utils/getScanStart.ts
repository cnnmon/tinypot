import { EntryType, Schema } from '@/types/schema';

/**
 * Get the starting index for scanning a scene's entries.
 * If the scene starts with a SCENE marker, start after it.
 */
export function getScanStart(schema: Schema, sceneStart: number): number {
  if (sceneStart < 0 || sceneStart >= schema.length) return sceneStart;
  return schema[sceneStart]?.type === EntryType.SCENE ? sceneStart + 1 : sceneStart;
}
