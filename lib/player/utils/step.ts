import { Line, Sender } from '@/types/playthrough';
import {
  ConditionalEntry,
  EntryType,
  ImageEntry,
  JumpEntry,
  MetadataEntry,
  NarrativeEntry,
  Schema,
  SchemaEntry,
} from '@/types/schema';
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
  type: 'narrative' | 'image' | 'wait' | 'set' | 'unset';
  narrativeIdx?: number;
  text?: string;
  variable?: string;
}

interface BuildPositionsResult {
  positions: ScenePosition[];
  jumpTarget: string | null; // Target scene if a jump was encountered (null = no jump, 'END' = end game)
}

function buildScenePositions(
  schema: Schema, 
  scanStart: number,
  hasVariable?: (variable: string) => boolean,
): BuildPositionsResult {
  const positions: ScenePosition[] = [];
  let pendingOptions = false;
  let jumpTarget: string | null = null;

  // Helper to recursively process entries
  // Returns the jump target if one was encountered, null otherwise
  const processEntries = (entries: SchemaEntry[]): string | null => {
    for (const entry of entries) {
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
      } else if (entry.type === EntryType.METADATA) {
        // Handle sets/unsets metadata
        const meta = entry as MetadataEntry;
        if (meta.key === 'sets') {
          positions.push({ type: 'set', variable: meta.value });
        } else if (meta.key === 'unsets') {
          positions.push({ type: 'unset', variable: meta.value });
        }
      } else if (entry.type === EntryType.CONDITIONAL) {
        // Evaluate conditional and include appropriate branch
        const conditional = entry as ConditionalEntry;
        const conditionMet = evaluateCondition(conditional.condition, hasVariable);
        const branchEntries = conditionMet ? conditional.then : conditional.else;
        
        if (branchEntries) {
          // Recursively process the conditional's entries
          const target = processEntries(branchEntries);
          if (target !== null) return target;
        }
      } else if (entry.type === EntryType.OPTION) {
        pendingOptions = true;
      } else if (entry.type === EntryType.JUMP) {
        // Jump ends the scene traversal for positions
        return (entry as JumpEntry).target.trim();
      }
    }
    return null;
  };

  // Process main entries starting from scanStart
  const entriesToProcess = schema.slice(scanStart);
  jumpTarget = processEntries(entriesToProcess);
  
  if (jumpTarget === null && pendingOptions) {
    positions.push({ type: 'wait' });
  }

  return { positions, jumpTarget };
}

/**
 * Evaluate a condition based on variable state.
 * Supports negation with ! prefix.
 */
function evaluateCondition(
  condition: string,
  hasVariable?: (variable: string) => boolean,
): boolean {
  const trimmed = condition.trim();
  
  // Check for negation
  if (trimmed.startsWith('!')) {
    const varName = trimmed.slice(1).trim();
    return !hasVariable?.(varName);
  }
  
  return hasVariable?.(trimmed) ?? false;
}

/**
 * Callback type for variable operations during stepping
 */
export interface StepCallbacks {
  setVariable?: (variable: string) => void;
  unsetVariable?: (variable: string) => void;
  hasVariable?: (variable: string) => boolean;
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
  callbacks,
}: {
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
  lineIdx: number;
  callbacks?: StepCallbacks;
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
    const { positions, jumpTarget } = buildScenePositions(schema, scanStart, callbacks?.hasVariable);

    // Check if the position exists
    if (currentLineIdx < positions.length) {
      const pos = positions[currentLineIdx];
      if (pos.type === 'wait') {
        return { type: 'wait' };
      }
      // Handle variable set/unset positions
      if (pos.type === 'set' && pos.variable && callbacks?.setVariable) {
        callbacks.setVariable(pos.variable);
        // Continue to next position (don't show anything to player)
        currentLineIdx++;
        continue;
      }
      if (pos.type === 'unset' && pos.variable && callbacks?.unsetVariable) {
        callbacks.unsetVariable(pos.variable);
        // Continue to next position
        currentLineIdx++;
        continue;
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

    // Past the end of positions - use jump target from position building (includes conditionals)
    if (jumpTarget !== null) {
      if (jumpTarget === 'END') {
        return { type: 'end' };
      }
      currentScene = jumpTarget;
      currentLineIdx = 0;
      continue;
    }

    // No jump found - wait at end of scene (implicit loop)
    return { type: 'wait' };
  }
}
