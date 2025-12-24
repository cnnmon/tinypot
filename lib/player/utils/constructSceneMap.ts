import { EntryType, Schema } from '@/types/schema';

/**
 * Currently RELIES on the snapshot never updating.
 * Rules for the scene map:
 * "START" and "END" are reserved. If any scenes share the same name, only the first instance will be valid.
 * Violations of these rules are marked RED in the editor.
 */
export function constructSceneMap({ schema }: { schema: Schema }): Record<string, number> {
  const sceneMap: Record<string, number> = { START: 0, END: -1 /* Should never hit */ };

  for (let i = 0; i < schema.length; i++) {
    const entry = schema[i];
    if (entry.type === EntryType.SCENE) {
      const label = entry.label.trim();
      // Only add if not already in map
      if (!sceneMap[label]) {
        sceneMap[label] = i;
      }
    }
  }

  return sceneMap;
}
