import { Line, Sender } from '@/types/playthrough';
import { EntryType, JumpEntry, Schema } from '@/types/schema';
import { getScanStart } from './getScanStart';

function makeLineId(sceneId: string, lineIdx: number): string {
  return `${sceneId}-${lineIdx}`;
}

function makeErrorLine(errorType: string, message: string): Line {
  return {
    id: `error-${errorType}`,
    sender: Sender.SYSTEM,
    text: message,
  };
}

/**
 * Find the next step in the game.
 * Returns the type of step ('continue', 'wait', 'end', 'error') and the line if applicable.
 * The line includes the NEW scene and lineIdx after following any jumps.
 */
export function step({
  schema,
  sceneMap,
  sceneId,
  lineIdx,
}: {
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
  lineIdx: number;
}): {
  type: 'continue' | 'wait' | 'end' | 'error';
  line?: Line;
} {
  let currentScene = sceneId;
  let currentLineIdx = lineIdx;
  const visited = new Set<string>();
  const visitedScenes = new Set<string>();

  // Follow jumps until we find a narrative line or hit END
  while (true) {
    const visitKey = `${currentScene}-${currentLineIdx}`;
    if (visited.has(visitKey)) {
      return {
        type: 'error',
        line: makeErrorLine('loop', `Infinite loop detected: ${visitKey}`),
      };
    }
    visited.add(visitKey);

    // If we've visited this scene before at line 0, we're in an infinite loop
    if (visitedScenes.has(currentScene) && currentLineIdx === 0) {
      return {
        type: 'error',
        line: makeErrorLine('loop', `Infinite loop detected: ${currentScene}`),
      };
    }
    if (currentLineIdx === 0) {
      visitedScenes.add(currentScene);
    }

    const sceneStart = sceneMap[currentScene];
    if (sceneStart === undefined) {
      return {
        type: 'error',
        line: makeErrorLine('scene', `Scene ${currentScene} not found`),
      };
    }

    let narrativeCount = 0;
    let didJump = false;

    const scanStart = getScanStart(schema, sceneStart);
    for (let i = scanStart; i < schema.length; i++) {
      const entry = schema[i];

      // Stop if we hit another scene
      if (entry.type === EntryType.SCENE) {
        break;
      }

      if (entry.type === EntryType.NARRATIVE) {
        // If this is the line we're looking for, return it
        if (narrativeCount === currentLineIdx) {
          return {
            type: 'continue',
            line: {
              id: makeLineId(currentScene, narrativeCount),
              sender: Sender.NARRATOR,
              text: entry.text,
            },
          };
        }
        narrativeCount++;
      } else if (entry.type === EntryType.JUMP) {
        // If we encounter a jump before finding the target line, follow it
        if (narrativeCount <= currentLineIdx) {
          const jumpEntry = entry as JumpEntry;
          if (jumpEntry.target === 'END') {
            return {
              type: 'end',
            };
          }
          // Follow the jump to the target scene, starting at line 0
          currentScene = jumpEntry.target.trim();
          currentLineIdx = 0;
          didJump = true;
          break;
        }
      }
      // Skip options (they don't count as lines)
    }

    // If we didn't jump and didn't find a next narrative, there's no next line (wait for options)
    if (!didJump) {
      return {
        type: 'wait',
      };
    }
  }
}
