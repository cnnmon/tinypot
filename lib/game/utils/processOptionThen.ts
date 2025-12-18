import { PlaythroughEntry } from '@/types/playthroughs';
import { LineType, SchemaLine } from '@/types/schema';

/**
 * Processes an option's "then" block and returns:
 * - lines: narrative entries to add to history
 * - jumpTarget: the scene to jump to (or "END", or null if no jump)
 */
export function processOptionThen(thenBlock: SchemaLine[]): {
  lines: PlaythroughEntry[];
  jumpTarget: string | null;
} {
  const lines: PlaythroughEntry[] = [];
  let jumpTarget: string | null = null;

  for (const line of thenBlock) {
    switch (line.type) {
      case LineType.NARRATIVE:
        lines.push({ text: line.text });
        break;
      case LineType.JUMP:
        jumpTarget = line.target;
        break;
      // Nested options/scenes in then blocks are not supported yet
    }
  }

  return { lines, jumpTarget };
}

