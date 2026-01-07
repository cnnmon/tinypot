import { Line, Sender } from '@/types/playthrough';
import { EntryType, ImageEntry, JumpEntry, NarrativeEntry, Schema } from '@/types/schema';
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
 * Build a linear sequence of positions in a scene.
 * Each position is either a narrative or a decision point (where options exist).
 *
 * For a scene like:
 *   narrative 0
 *   option A
 *   option B
 *   narrative 1
 *
 * The positions are:
 *   0: narrative 0
 *   1: decision point (options before narrative 1)
 *   2: narrative 1
 *   3: decision point (end of scene, implicit loop)
 */
interface ScenePosition {
  type: 'narrative' | 'image' | 'wait';
  narrativeIdx?: number;
  text?: string;
}

function buildScenePositions(schema: Schema, scanStart: number): ScenePosition[] {
  const positions: ScenePosition[] = [];
  let pendingOptions = false;

  for (let i = scanStart; i < schema.length; i++) {
    const entry = schema[i];
    if (entry.type === EntryType.SCENE) break;

    if (entry.type === EntryType.NARRATIVE || entry.type === EntryType.IMAGE) {
      // If there were options before this narrative/image, add a decision point
      if (pendingOptions) {
        positions.push({ type: 'wait' });
        pendingOptions = false;
      }
      const isImage = entry.type === EntryType.IMAGE;
      positions.push({
        type: isImage ? 'image' : 'narrative',
        narrativeIdx: positions.filter((p) => p.type === 'narrative' || p.type === 'image').length,
        text: isImage ? (entry as ImageEntry).url : (entry as NarrativeEntry).text,
      });
    } else if (entry.type === EntryType.OPTION) {
      pendingOptions = true;
    } else if (entry.type === EntryType.JUMP) {
      // Jump ends the scene traversal for positions
      break;
    }
  }

  // If there are pending options at the end, add a final decision point
  if (pendingOptions) {
    positions.push({ type: 'wait' });
  }

  return positions;
}

/**
 * Find the next step in the game.
 * Returns the type of step ('continue', 'wait', 'end', 'error') and the line if applicable.
 *
 * lineIdx counts positions in the scene, where positions include both narratives
 * and decision points (where options exist).
 *
 * Decision points occur:
 * 1. When options are encountered between narratives
 * 2. At the end of a scene with options (implicit loop)
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

    const scanStart = getScanStart(schema, sceneStart);
    const positions = buildScenePositions(schema, scanStart);

    // Check if the position exists
    if (currentLineIdx < positions.length) {
      const pos = positions[currentLineIdx];
      if (pos.type === 'wait') {
        return { type: 'wait' };
      }
      return {
        type: 'continue',
        line: {
          id: makeLineId(currentScene, currentLineIdx),
          sender: Sender.NARRATOR,
          text: pos.text!,
          ...(pos.type === 'image' && { type: 'image' as const }),
        },
      };
    }

    // Past the end of positions - check for jumps or wait at end
    let didJump = false;
    for (let i = scanStart; i < schema.length; i++) {
      const entry = schema[i];
      if (entry.type === EntryType.SCENE) break;

      if (entry.type === EntryType.JUMP) {
        const jumpEntry = entry as JumpEntry;
        if (jumpEntry.target === 'END') {
          return { type: 'end' };
        }
        currentScene = jumpEntry.target.trim();
        currentLineIdx = 0;
        didJump = true;
        break;
      }
    }

    if (!didJump) {
      // No more positions and no jump - wait at end of scene (implicit loop)
      return { type: 'wait' };
    }
  }
}
