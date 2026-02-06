import { Entity } from '@/types/entities';
import { Line } from '@/types/playthrough';
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

function makeLineId(sceneId: string, lineIdx: number): `${string}-${number}` {
  return `${sceneId}-${lineIdx}`;
}

function makeErrorLine(errorType: string, message: string): Line {
  return {
    id: `error-${errorType}` as `${string}-${number}`,
    sender: Entity.SYSTEM,
    text: message,
  };
}

/**
 * Process the global preamble (entries before the first @SCENE).
 * Processes `when` conditional blocks and collects their narratives/jumps.
 * Also finds any top-level goto to use as entry point.
 */
export function processGlobalPreamble(
  schema: Schema,
  hasVariable?: (variable: string, threshold?: number) => boolean,
  includeTopLevelGoto?: boolean,
  getVariable?: (variable: string) => number,
): { jumpTarget: string | null; narratives: string[]; entryPoint: string | null } {
  const narratives: string[] = [];
  let entryPoint: string | null = null;
  
  // Find entries before the first scene
  const firstSceneIdx = schema.findIndex((e) => e.type === EntryType.SCENE);
  if (firstSceneIdx <= 0) {
    return { jumpTarget: null, narratives: [], entryPoint: null };
  }

  const preamble = schema.slice(0, firstSceneIdx);

  // Process preamble entries
  for (const entry of preamble) {
    if (entry.type === EntryType.CONDITIONAL) {
      const conditional = entry as ConditionalEntry;
      const conditionMet = evaluateCondition(conditional.condition, hasVariable, getVariable);
      
      if (conditionMet && conditional.then) {
        // Process the matched conditional's content
        for (const innerEntry of conditional.then) {
          if (innerEntry.type === EntryType.NARRATIVE) {
            narratives.push((innerEntry as NarrativeEntry).text);
          } else if (innerEntry.type === EntryType.JUMP) {
            // Return immediately on conditional jump
            return { jumpTarget: (innerEntry as JumpEntry).target.trim(), narratives, entryPoint };
          }
        }
      }
    } else if (entry.type === EntryType.JUMP && includeTopLevelGoto) {
      // Top-level goto - use as entry point only if requested
      entryPoint = (entry as JumpEntry).target.trim();
    }
    // Ignore top-level narratives - they would show on every scene entry
  }

  return { jumpTarget: null, narratives, entryPoint };
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
  getVariable?: (variable: string) => number,
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
        const conditionMet = evaluateCondition(conditional.condition, hasVariable, getVariable);
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
 * Evaluate a single condition clause (no & operators).
 * Supports:
 * - Simple check: `var` (true if var >= 1)
 * - Negation: `!var` (true if var = 0)
 * - Greater-equal: `var >= N` (true if var >= N)
 * - Less-than: `var < N` (true if var < N)
 */
function evaluateSingleCondition(
  condition: string,
  hasVariable?: (variable: string, threshold?: number) => boolean,
  getVariableValue?: (variable: string) => number,
): boolean {
  const trimmed = condition.trim();

  // Check for less-than comparison: var < N
  const lessThanMatch = trimmed.match(/^(\w+)\s*<\s*(\d+)$/);
  if (lessThanMatch) {
    const varName = lessThanMatch[1];
    const threshold = parseInt(lessThanMatch[2], 10);
    const value = getVariableValue?.(varName) ?? 0;
    return value < threshold;
  }

  // Check for threshold comparison: var >= N
  const thresholdMatch = trimmed.match(/^(\w+)\s*>=\s*(\d+)$/);
  if (thresholdMatch) {
    const varName = thresholdMatch[1];
    const threshold = parseInt(thresholdMatch[2], 10);
    return hasVariable?.(varName, threshold) ?? false;
  }

  // Check for negation
  if (trimmed.startsWith('!')) {
    const varName = trimmed.slice(1).trim();
    return !hasVariable?.(varName);
  }

  // Simple check (var >= 1)
  return hasVariable?.(trimmed) ?? false;
}

/**
 * Evaluate a condition based on variable state.
 * Supports compound conditions with & (AND):
 * - `var >= 2 & var < 3` (both must be true)
 */
function evaluateCondition(
  condition: string,
  hasVariable?: (variable: string, threshold?: number) => boolean,
  getVariableValue?: (variable: string) => number,
): boolean {
  const trimmed = condition.trim();

  // Split on & for compound conditions
  const parts = trimmed.split('&').map((p) => p.trim());
  
  // All parts must evaluate to true (AND logic)
  return parts.every((part) => evaluateSingleCondition(part, hasVariable, getVariableValue));
}

/**
 * Callback type for variable operations during stepping
 */
export interface StepCallbacks {
  setVariable?: (variable: string) => void;
  unsetVariable?: (variable: string) => void;
  /** Check if variable exists (>= 1) or meets threshold (>= N) */
  hasVariable?: (variable: string, threshold?: number) => boolean;
  /** Get the raw value of a variable (0 if not set) */
  getVariable?: (variable: string) => number;
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
  // Check if the current scene ACTUALLY exists as a scene in the schema
  // (sceneMap always has START:0, but that doesn't mean @START exists)
  const sceneIdx = sceneMap[sceneId];
  const sceneExists = sceneIdx !== undefined && 
    sceneIdx >= 0 && 
    sceneIdx < schema.length && 
    schema[sceneIdx]?.type === EntryType.SCENE;
  
  // Check global preamble ONLY when entering a scene fresh (lineIdx === 0)
  // Also include top-level goto if current scene doesn't exist (for entry point)
  let preambleNarrative: string | null = null;
  if (lineIdx === 0) {
    const preambleResult = processGlobalPreamble(schema, callbacks?.hasVariable, !sceneExists, callbacks?.getVariable);
    
    // If scene doesn't exist and there's an entry point goto, use it
    if (!sceneExists && preambleResult.entryPoint) {
      sceneId = preambleResult.entryPoint;
    }
    
    // Check for conditional jumps (e.g., when turn >= 20 -> goto @END)
    if (preambleResult.jumpTarget) {
      if (preambleResult.jumpTarget === 'END') {
        // Check if there's an actual @END scene with content
        const endSceneIdx = sceneMap['END'];
        if (endSceneIdx >= 0 && schema[endSceneIdx]?.type === EntryType.SCENE) {
          // Jump to @END scene to play its content first
          sceneId = 'END';
        } else {
          return { type: 'end' };
        }
      } else {
        // Override scene with preamble jump target
        sceneId = preambleResult.jumpTarget;
      }
    }
    
    // Collect preamble narratives to prepend to the first line
    if (preambleResult.narratives.length > 0) {
      preambleNarrative = preambleResult.narratives.join(' ');
    }
  }

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
    const { positions, jumpTarget } = buildScenePositions(schema, scanStart, callbacks?.hasVariable, callbacks?.getVariable);

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
      // Prepend preamble narrative to the first line if present
      const lineText = pos.type === 'image' ? '' : pos.text!;
      const textWithPreamble = preambleNarrative && currentLineIdx === 0
        ? `${preambleNarrative}\n\n${lineText}`
        : lineText;
      
      return {
        type: 'continue',
        line: {
          id: makeLineId(currentScene, currentLineIdx),
          sender: Entity.AUTHOR,
          text: textWithPreamble,
          ...(pos.type === 'image' && { metadata: { imageUrl: pos.text } }),
        },
      };
    }

    // Past the end of positions - use jump target from position building (includes conditionals)
    if (jumpTarget !== null) {
      // Check if we're already in @END scene - if so, actually end the game
      if (currentScene === 'END') {
        return { type: 'end' };
      }
      
      if (jumpTarget === 'END') {
        // Check if there's an actual @END scene with content
        const endSceneIdx = sceneMap['END'];
        if (endSceneIdx >= 0 && schema[endSceneIdx]?.type === EntryType.SCENE) {
          // Jump to @END scene to play its content first
          currentScene = 'END';
          currentLineIdx = 0;
          continue;
        }
        // No @END scene defined, just end immediately
        return { type: 'end' };
      }
      currentScene = jumpTarget;
      currentLineIdx = 0;
      continue;
    }
    
    // If we're at the end of @END scene with no explicit goto, end the game
    if (currentScene === 'END') {
      return { type: 'end' };
    }

    // No jump found - wait at end of scene (implicit loop)
    return { type: 'wait' };
  }
}
