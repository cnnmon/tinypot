/**
 * Core game engine - runs the interactive narrative from a schema.
 * Handles advancing through narrative, collecting options, and processing jumps.
 */

import { GameState, GameStatus } from '@/types/games';
import { Playthrough, PlaythroughEntry } from '@/types/playthroughs';
import { LineType, OptionLine, Schema } from '@/types/schema';
import { buildSceneMap, SceneMap } from './utils/buildSceneMap';
import { collectOptions } from './utils/collectOptions';
import { findLastDecisionPoint } from './utils/findLastDecisionPoint';
import { findSceneIntroEnd } from './utils/findSceneIntroEnd';
import { processOptionThen } from './utils/processOptionThen';

/**
 * Marks all history entries as animated (used after animation completes).
 */
export function markHistoryAnimated(state: GameState): GameState {
  return { ...state, animatedCount: state.history.length };
}
/**
 * Creates initial game state from a schema, running until first decision point.
 */
export function createInitialGameState(schema: Schema): GameState {
  const sceneMap = buildSceneMap(schema);
  const sceneIntroEndIdx = findSceneIntroEnd(schema, 0);
  return runGameFrom(schema, 0, sceneMap, [], sceneIntroEndIdx, 0, [], false);
}

/**
 * Core game runner - advances from a starting index until hitting options or end.
 * If skipIntro is true, skips narrative lines until hitting options.
 */
export function runGameFrom(
  schema: Schema,
  startIdx: number,
  sceneMap: SceneMap,
  prevHistory: PlaythroughEntry[] = [],
  sceneIntroEndIdx: number = 0,
  animatedCount: number = 0,
  consumedOptions: string[] = [],
  skipIntro: boolean = false
): GameState {
  const history = [...prevHistory];
  let idx = startIdx;
  let skipping = skipIntro;

  while (idx < schema.length) {
    const line = schema[idx];

    switch (line.type) {
      case LineType.NARRATIVE:
        if (!skipping) {
          history.push({ text: line.text });
        }
        idx++;
        break;

      case LineType.SCENE:
        idx++;
        // Only reset consumed options if this is a new scene (not skipping)
        if (!skipping) {
          consumedOptions = [];
        }
        break;

      case LineType.OPTION:
        skipping = false; // Stop skipping when we reach options
        const options = collectOptions(schema, idx);
        return {
          history,
          currentOptions: options,
          currentLineIdx: idx,
          status: GameStatus.WAITING,
          animatedCount,
          consumedOptions,
        };

      case LineType.JUMP:
        if (line.target === 'END') {
          return {
            history,
            currentOptions: [],
            currentLineIdx: idx,
            status: GameStatus.ENDED,
            animatedCount,
            consumedOptions,
          };
        }
        const sceneIdx = sceneMap.get(line.target);
        if (sceneIdx !== undefined) {
          idx = sceneIdx;
          // Only reset consumed options and update intro if entering a new scene
          if (!skipping) {
            consumedOptions = [];
            sceneIntroEndIdx = history.length + findSceneIntroEnd(schema, sceneIdx);
          }
        } else {
          console.warn(`Scene "${line.target}" not found`);
          return {
            history,
            currentOptions: [],
            currentLineIdx: idx,
            status: GameStatus.ENDED,
            animatedCount,
            consumedOptions,
          };
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
    return {
      history,
      currentOptions: options,
      currentLineIdx: lastDecision,
      status: GameStatus.WAITING,
      animatedCount,
      consumedOptions,
    };
  }

  return {
    history,
    currentOptions: [],
    currentLineIdx: idx,
    status: GameStatus.ENDED,
    animatedCount,
    consumedOptions,
  };
}

/**
 * Processes an option selection and returns the next game state.
 * Sets animatedCount to previous history length so new entries animate in.
 * Adds option to consumedOptions so it can be disabled.
 */
export function selectGameOption(
  schema: Schema,
  sceneMap: SceneMap,
  currentState: GameState,
  option: OptionLine
): GameState {
  if (currentState.status === GameStatus.ENDED) return currentState;

  // Mark current history as animated before adding new entries
  const animatedCount = currentState.history.length;

  // Add option to consumed list
  const consumedOptions = [...currentState.consumedOptions, option.text];

  // Add the choice to history (marked as a choice for styling)
  const newHistory: PlaythroughEntry[] = [
    ...currentState.history,
    { text: option.text, isChoice: true },
  ];

  // Process the "then" block
  const { lines: thenLines, jumpTarget } = processOptionThen(option.then);
  newHistory.push(...thenLines);

  // Handle END jump
  if (jumpTarget === 'END') {
    return {
      ...currentState,
      history: newHistory,
      currentOptions: [],
      status: GameStatus.ENDED,
      animatedCount,
      consumedOptions,
    };
  }

  // If there's a jump target, go there
  if (jumpTarget) {
    const sceneIdx = sceneMap.get(jumpTarget);
    const nextIdx = sceneIdx !== undefined ? sceneIdx : currentState.currentLineIdx + 1;
    const newSceneIntroEnd = newHistory.length + findSceneIntroEnd(schema, nextIdx);

    // Check if jumping back to the SAME scene
    const currentScene = getCurrentSceneLabel(schema, currentState.currentLineIdx);
    const isSameScene = currentScene === jumpTarget;
    const shouldSkipIntro = isSameScene && consumedOptions.length > 0;

    return runGameFrom(
      schema,
      nextIdx,
      sceneMap,
      newHistory,
      newSceneIntroEnd,
      animatedCount,
      isSameScene ? consumedOptions : [], // Keep consumed options if same scene
      shouldSkipIntro
    );
  }

  // No jump = stay at current options (loop back with consumed options tracked)
  return {
    ...currentState,
    history: newHistory,
    currentOptions: currentState.currentOptions,
    status: GameStatus.WAITING,
    animatedCount,
    consumedOptions,
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
 * Gets the label of the current scene (nearest SCENE marker before idx).
 */
function getCurrentSceneLabel(schema: Schema, beforeIdx: number): string | null {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    const line = schema[i];
    if (line.type === LineType.SCENE) {
      return line.label;
    }
  }
  return null;
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
  if (currentState.status === GameStatus.ENDED) {
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
  const sceneIntroEndIdx = findSceneIntroEnd(schema, sceneStart);

  // Re-run from scene start to rebuild history
  return runGameFrom(
    schema,
    sceneStart,
    sceneMap,
    [],
    sceneIntroEndIdx,
    currentState.animatedCount,
    currentState.consumedOptions,
    false // Don't skip intro on schema refresh
  );
}

/**
 * Jumps back to a specific choice in history.
 * Truncates history to just before that choice and restores options.
 */
export function jumpBackToChoice(
  schema: Schema,
  currentState: GameState,
  choiceHistoryIndex: number
): GameState {
  // Truncate history to just before the choice
  const newHistory = currentState.history.slice(0, choiceHistoryIndex);

  // Find the choice text to locate it in schema
  const choiceEntry = currentState.history[choiceHistoryIndex];
  if (!choiceEntry || !('text' in choiceEntry)) {
    return currentState; // Invalid index
  }

  const choiceText = choiceEntry.text;

  // Find the options that contain this choice
  const optionsIdx = findOptionByText(schema, choiceText);
  if (optionsIdx === -1) {
    return currentState; // Choice not found in schema
  }

  const options = collectOptions(schema, optionsIdx);

  return {
    history: newHistory,
    currentOptions: options,
    currentLineIdx: optionsIdx,
    status: GameStatus.WAITING,
    animatedCount: newHistory.length,
    consumedOptions: [], // Reset consumed options
  };
}

/**
 * Finds the index of an option group containing the given text.
 */
function findOptionByText(schema: Schema, text: string): number {
  for (let i = 0; i < schema.length; i++) {
    if (schema[i].type === LineType.OPTION) {
      // Check all options in this group
      const options = collectOptions(schema, i);
      if (options.some((opt) => opt.text === text)) {
        return i;
      }
      // Skip past this option group
      i += options.length - 1;
    }
  }
  return -1;
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
  const sceneStart = findSceneStart(currentSchema, playthrough.currentLineIdx);
  const sceneIntroEndIdx = findSceneIntroEnd(currentSchema, sceneStart);

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
      status: GameStatus.WAITING,
      animatedCount: playthrough.history.length,
      consumedOptions: [],
    };
  }

  // Otherwise run forward from current position with committed history
  return runGameFrom(
    currentSchema,
    playthrough.currentLineIdx,
    sceneMap,
    playthrough.history,
    sceneIntroEndIdx,
    playthrough.history.length,
    [],
    false
  );
}
