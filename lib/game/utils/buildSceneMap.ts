import { LineType, Schema } from '@/types/schema';

/** Map of scene labels to their line indices in the schema */
export type SceneMap = Map<string, number>;

/** Builds a map of scene labels to their starting indices */
export function buildSceneMap(schema: Schema): SceneMap {
  const map = new Map<string, number>();
  schema.forEach((line, idx) => {
    if (line.type === LineType.SCENE) {
      map.set(line.label, idx);
    }
  });
  return map;
}
