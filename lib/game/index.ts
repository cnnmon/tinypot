/**
 * Core game engine - runs the interactive narrative from a schema.
 * Handles advancing through narrative, collecting options, and processing jumps.
 */

import { Playthrough, PlaythroughEntry } from '@/types/playthroughs';
import { LineType, OptionLine, Schema } from '@/types/schema';
import { buildSceneMap, SceneMap } from './utils/buildSceneMap';
import { collectOptions } from './utils/collectOptions';
import { findLastDecisionPoint } from './utils/findLastDecisionPoint';
import { processOptionThen } from './utils/processOptionThen';

export { buildSceneMap, collectOptions, findLastDecisionPoint, processOptionThen };
export type { SceneMap };

/** Represents the current UI state during gameplay */
export interface GameState {
  history: PlaythroughEntry[];
  currentLineIdx: number;
  currentOptions: OptionLine[];
  isEnded: boolean;
}

/**
 * Creates initial game state from a schema, running until first decision point.
 */
export function createInitialGameState(schema: Schema): GameState {
  const sceneMap = buildSceneMap(schema);
  return runGameFrom(schema, 0, sceneMap, []);
}

/**
 * Core game runner - advances from a starting index until hitting options or end.
 * Returns the new game state.
 */
export function runGameFrom(
  schema: Schema,
  startIdx: number,
  sceneMap: SceneMap,
  prevHistory: PlaythroughEntry[] = []
): GameState {
  const history = [...prevHistory];
  let idx = startIdx;

  while (idx < schema.length) {
    const line = schema[idx];

    switch (line.type) {
      case LineType.NARRATIVE:
        history.push({ text: line.text });
        idx++;
        break;

      case LineType.SCENE:
        // Scene markers are just labels, skip them
        idx++;
        break;

      case LineType.OPTION:
        // Hit options - collect them all and pause for input
        const options = collectOptions(schema, idx);
        return { history, currentOptions: options, currentLineIdx: idx, isEnded: false };

      case LineType.JUMP:
        if (line.target === 'END') {
          return { history, currentOptions: [], currentLineIdx: idx, isEnded: true };
        }
        // Jump to scene
        const sceneIdx = sceneMap.get(line.target);
        if (sceneIdx !== undefined) {
          idx = sceneIdx;
        } else {
          console.warn(`Scene "${line.target}" not found`);
          return { history, currentOptions: [], currentLineIdx: idx, isEnded: true };
        }
        break;

      default:
        idx++;
    }
  }

  // Reached end of schema without explicit END - loop back to last decision
  const lastDecision = findLastDecisionPoint(schema, idx);
  const options = collectOptions(schema, lastDecision);

  if (options.length > 0) {
    return { history, currentOptions: options, currentLineIdx: lastDecision, isEnded: false };
  }

  // No decision points at all - game just ends
  return { history, currentOptions: [], currentLineIdx: idx, isEnded: true };
}

/**
 * Processes an option selection and returns the next game state.
 */
export function selectGameOption(
  schema: Schema,
  sceneMap: SceneMap,
  currentState: GameState,
  option: OptionLine
): GameState {
  if (currentState.isEnded) return currentState;

  // Add the choice to history
  const newHistory: PlaythroughEntry[] = [...currentState.history, { text: option.text }];

  // Process the "then" block
  const { lines: thenLines, jumpTarget } = processOptionThen(option.then);
  newHistory.push(...thenLines);

  // Handle END jump
  if (jumpTarget === 'END') {
    return { ...currentState, history: newHistory, currentOptions: [], isEnded: true };
  }

  // If there's a jump target, go there. Otherwise, loop back to same options.
  if (jumpTarget) {
    const sceneIdx = sceneMap.get(jumpTarget);
    const nextIdx = sceneIdx !== undefined ? sceneIdx : currentState.currentLineIdx + 1;
    return runGameFrom(schema, nextIdx, sceneMap, newHistory);
  }

  // No jump = stay at current options (loop back)
  return {
    history: newHistory,
    currentLineIdx: currentState.currentLineIdx,
    currentOptions: currentState.currentOptions,
    isEnded: false,
  };
}

/**
 * Finds the start of the current scene (nearest SCENE marker before idx, or 0).
 */
function findSceneStart(schema: Schema, beforeIdx: number): number {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (schema[i].type === LineType.SCENE) {
      return i;
    }
  }
  return 0;
}

/**
 * Finds options near a position (searching forward then backward).
 */
function findNearbyOptions(schema: Schema, fromIdx: number): number {
  // Search forward
  for (let i = Math.max(0, fromIdx); i < schema.length; i++) {
    if (schema[i].type === LineType.OPTION) return i;
  }
  // Search backward
  for (let i = Math.min(schema.length - 1, fromIdx); i >= 0; i--) {
    if (schema[i].type === LineType.OPTION) return i;
  }
  return -1;
}

/**
 * Refreshes game state when schema changes.
 * Re-runs from current scene to pick up added/removed narrative lines.
 */
export function refreshGameOptions(schema: Schema, currentState: GameState): GameState {
  if (currentState.isEnded) {
    return createInitialGameState(schema);
  }

  // Find options near current position
  const optionsIdx = findNearbyOptions(schema, currentState.currentLineIdx);
  if (optionsIdx === -1) {
    return createInitialGameState(schema);
  }

  // Find scene start before these options
  const sceneStart = findSceneStart(schema, optionsIdx);
  const sceneMap = buildSceneMap(schema);

  // Re-run from scene start to rebuild history for this scene
  return runGameFrom(schema, sceneStart, sceneMap, []);
}

/**
 * Converts GameState to a persistable Playthrough.
 */
export function gameStateToPlaythrough(gameId: string, state: GameState): Playthrough {
  return {
    id: crypto.randomUUID(),
    gameId,
    currentLineIdx: state.currentLineIdx,
    history: state.history,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Resumes a Playthrough with a (possibly updated) schema.
 * Keeps the committed history, refreshes options from current schema.
 */
export function resumePlaythrough(playthrough: Playthrough, currentSchema: Schema): GameState {
  const sceneMap = buildSceneMap(currentSchema);

  // If at an option point, collect options from current schema
  if (
    playthrough.currentLineIdx < currentSchema.length &&
    currentSchema[playthrough.currentLineIdx].type === LineType.OPTION
  ) {
    const options = collectOptions(currentSchema, playthrough.currentLineIdx);
    return {
      history: playthrough.history,
      currentLineIdx: playthrough.currentLineIdx,
      currentOptions: options,
      isEnded: false,
    };
  }

  // Otherwise run forward from current position with committed history
  return runGameFrom(currentSchema, playthrough.currentLineIdx, sceneMap, playthrough.history);
}
