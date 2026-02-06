import { EntryType, Schema } from '@/types/schema';

/**
 * Currently RELIES on the snapshot never updating.
 * Rules for the scene map:
 * - Game always starts at @START (or index 0 if no @START scene exists)
 * - @END is a valid scene that can contain content before ending
 * - goto @END jumps to @END scene if it exists, then ends the game
 * - If any scenes share the same name, only the first instance will be valid.
 * Violations of these rules are marked RED in the editor.
 */
export function constructSceneMap({ schema }: { schema: Schema }): Record<string, number> {
  // START defaults to 0 (beginning of script), END to -1 (special: ends game)
  // These will be overwritten if actual @START or @END scenes exist
  const sceneMap: Record<string, number> = { START: 0, END: -1 };

  for (let i = 0; i < schema.length; i++) {
    const entry = schema[i];
    if (entry.type === EntryType.SCENE) {
      const label = entry.label.trim();
      // Only add if not already in map (use hasOwnProperty to handle START:0 case)
      // Always allow updating START and END since their defaults are placeholders
      if (!(label in sceneMap) || label === 'START' || label === 'END') {
        // Only update if this is the first real scene with this label
        if (sceneMap[label] === 0 || sceneMap[label] === -1 || !(label in sceneMap)) {
          sceneMap[label] = i;
        }
      }
    }
  }

  return sceneMap;
}
