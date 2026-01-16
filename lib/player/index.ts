'use client';

import { GenerateRequest, GenerateResponse } from '@/app/api/generate/route';
import { createBranch } from '@/lib/branch';
import { Line, Playthrough, Sender } from '@/types/playthrough';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProject } from '../project';
import { addAliasToOption, addGeneratedOptionToScript, parseIntoSchema } from '../project/parser';
import { useVariables } from './useVariables';
import {
  constructSceneMap,
  getSceneAndLineIdx,
  isSchemaEditValid,
  matchInput,
  parseLineId,
  step,
} from './utils/index';
import { getAllowsForScene, getOptionsAtPosition } from './utils/matchInput/utils';

/**
 * Find the path of choices to reach a target line in the script.
 * Returns an array of choice texts (using first alias if available).
 */
export function findReplayPath(script: string[], targetLineIdx: number): string[] {
  // Find which scene the target line is in
  let targetScene = 'START';
  for (let i = targetLineIdx; i >= 0; i--) {
    const line = script[i].trim();
    if (line.startsWith('@')) {
      targetScene = line.slice(1);
      break;
    }
  }

  // If target is in START, no choices needed to get there
  if (targetScene === 'START') {
    // Check if the target line itself is a choice (not a conditional)
    const targetLine = script[targetLineIdx]?.trim();
    if (targetLine?.startsWith('if ')) {
      const afterIf = targetLine.slice(3).trim();
      if (!afterIf.startsWith('[')) {
        const parts = afterIf.split('|').map((p) => p.trim());
        return [parts[1] || parts[0]]; // Use first alias or text
      }
    }
    return [];
  }

  // Build a map of scenes and what choices lead to them
  const sceneChoices: Map<string, { from: string; choice: string }[]> = new Map();
  let currentScene = 'START';
  let firstScene: string | null = null;

  for (let i = 0; i < script.length; i++) {
    const line = script[i].trim();

    if (line.startsWith('@')) {
      currentScene = line.slice(1);
      if (!firstScene) firstScene = currentScene;
      continue;
    }

    if (line.startsWith('if ')) {
      const afterIf = line.slice(3).trim();
      // Skip conditional blocks: "if [key]" or "if [!key]"
      if (afterIf.startsWith('[')) continue;

      const parts = afterIf.split('|').map((p) => p.trim());
      const choiceInput = parts[1] || parts[0]; // First alias or text

      // Look for goto in the next few indented lines
      for (let j = i + 1; j < script.length; j++) {
        const nextLine = script[j];
        const nextTrimmed = nextLine.trim();

        // Stop if we hit a non-indented line or new scene
        if (nextTrimmed.startsWith('@') || nextTrimmed.startsWith('if ')) break;
        if (!nextLine.match(/^\s/) && nextTrimmed) break;

        if (nextTrimmed.startsWith('goto @')) {
          const dest = nextTrimmed.slice(6).trim();
          if (!sceneChoices.has(dest)) sceneChoices.set(dest, []);
          sceneChoices.get(dest)!.push({ from: currentScene, choice: choiceInput });
          break;
        }
      }
    }
  }

  // BFS to find path from START to targetScene
  // If the first scene is at the start (no content before it), treat it as equivalent to START
  const visited = new Set<string>();
  const startScenes = firstScene ? ['START', firstScene] : ['START'];
  const queue: { scene: string; path: string[] }[] = startScenes.map((s) => ({
    scene: s,
    path: [],
  }));

  while (queue.length > 0) {
    const { scene, path } = queue.shift()!;
    if (scene === targetScene) {
      // Check if the target line itself is a choice (not a conditional)
      const targetLine = script[targetLineIdx]?.trim();
      if (targetLine?.startsWith('if ')) {
        const afterIf = targetLine.slice(3).trim();
        if (!afterIf.startsWith('[')) {
          const parts = afterIf.split('|').map((p) => p.trim());
          return [...path, parts[1] || parts[0]];
        }
      }
      return path;
    }

    if (visited.has(scene)) continue;
    visited.add(scene);

    // Find all scenes reachable from this scene
    for (const [dest, routes] of sceneChoices) {
      for (const route of routes) {
        if (route.from === scene && !visited.has(dest)) {
          queue.push({ scene: dest, path: [...path, route.choice] });
        }
      }
    }
  }

  // Fallback: if target is a choice (not conditional), just return that choice
  const targetLine = script[targetLineIdx]?.trim();
  if (targetLine?.startsWith('if ')) {
    const afterIf = targetLine.slice(3).trim();
    if (!afterIf.startsWith('[')) {
      const parts = afterIf.split('|').map((p) => p.trim());
      return [parts[1] || parts[0]];
    }
  }

  return [];
}

export enum Status {
  RUNNING = 'running',
  WAITING = 'waiting',
  MATCHING = 'matching',
  GENERATING = 'generating',
  ENDED = 'ended',
}

export default function usePlayer() {
  const { projectId, schema, project, setProject, addOrMergeBranch, playerResetKey } = useProject();
  const variables = useVariables();

  const [playthrough, setPlaythrough] = useState<Playthrough>({
    id: 'abcdef',
    projectId: projectId,
    snapshot: JSON.parse(JSON.stringify(schema)), // Copy
    lines: [],
    createdAt: Date.now(),
  });

  // Track previous reset key to detect changes
  const prevResetKeyRef = useRef(playerResetKey);

  // Replay queue for auto-submitting choices
  const replayQueueRef = useRef<string[]>([]);

  /* Dynamic states */
  const sceneMap = useMemo(
    () => constructSceneMap({ schema: playthrough.snapshot }),
    [playthrough.snapshot],
  );

  const [state, setState] = useState({
    ...getSceneAndLineIdx({ lines: playthrough.lines, sceneMap }),
    status: Status.RUNNING,
  });

  const { currentSceneId, currentLineIdx, status } = state;

  // Ref to prevent double execution during React strict mode or rapid state changes
  const isSteppingRef = useRef(false);
  // Track last processed position to prevent duplicates from Strict Mode
  const lastProcessedRef = useRef<string | null>(null);

  useEffect(() => {
    // Accept any valid changes
    if (isSchemaEditValid(playthrough.snapshot, schema)) {
      setPlaythrough((prev) => ({
        ...prev,
        snapshot: schema,
      }));
    }
  }, [schema, playthrough.snapshot]);

  // Reset player when playerResetKey changes (e.g., after branch rejection)
  useEffect(() => {
    if (playerResetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = playerResetKey;
      // Reset the player
      setPlaythrough((prev) => ({
        ...prev,
        snapshot: JSON.parse(JSON.stringify(schema)),
        lines: [],
        createdAt: Date.now(),
      }));
      setState({
        status: Status.RUNNING,
        currentSceneId: 'START',
        currentLineIdx: 0,
      });
      variables.reset();
      lastProcessedRef.current = null;
    }
  }, [playerResetKey, schema, variables]);

  // Automatically go next until you can't
  const addLine = useCallback(
    (newLine: Line) => {
      setPlaythrough((prev) => ({
        ...prev,
        lines: [...prev.lines, newLine],
      }));

      // Only update scene/line state for narrator lines (advance to NEXT line)
      const parsedId = parseLineId(newLine.id);
      if (parsedId) {
        setState({
          ...state,
          currentSceneId: parsedId.sceneId,
          currentLineIdx: parsedId.lineIdx + 1,
        });
      }
    },
    [state],
  );

  const handleNext = useCallback(() => {
    // Prevent double execution
    if (isSteppingRef.current) return;

    // Prevent Strict Mode duplicates by tracking processed positions
    const positionKey = `${currentSceneId}-${currentLineIdx}`;
    if (lastProcessedRef.current === positionKey) return;

    isSteppingRef.current = true;
    lastProcessedRef.current = positionKey;

    const nextMove = step({
      schema: playthrough.snapshot,
      sceneMap,
      sceneId: currentSceneId,
      lineIdx: currentLineIdx,
      callbacks: {
        setVariable: variables.set,
        unsetVariable: variables.unset,
        hasVariable: variables.has,
      },
    });

    if (nextMove.type === 'wait') {
      setState({
        ...state,
        status: Status.WAITING,
      });
    } else if (nextMove.type === 'end') {
      setState({
        ...state,
        status: Status.ENDED,
      });
    } else if (nextMove.line) {
      // 'continue' type - add line and let the state update trigger next step
      addLine(nextMove.line);
    }

    isSteppingRef.current = false;
  }, [state, currentSceneId, currentLineIdx, sceneMap, addLine, playthrough.snapshot, variables]);

  useEffect(() => {
    if (status === Status.RUNNING && !isSteppingRef.current) {
      handleNext();
    }
  }, [status, handleNext]);

  // Fast matching for replay - skips LLM but shows narratives and processes metadata
  const handleReplayMatch = useCallback(
    async (input: string) => {
      const result = await matchInput({
        input,
        schema: playthrough.snapshot,
        sceneMap,
        sceneId: currentSceneId,
        lineIdx: currentLineIdx,
        useFuzzyFallback: false,
        hasVariable: variables.has,
      });

      if (result.matched) {
        // Add player's choice line
        addLine({
          id: 'player',
          sender: Sender.PLAYER,
          text: input,
        });

        // Process metadata (sets/unsets) from the option's then block
        if (result.metadata) {
          for (const meta of result.metadata) {
            if (meta.key === 'sets') {
              variables.set(meta.value);
            } else if (meta.key === 'unsets') {
              variables.unset(meta.value);
            }
          }
        }

        // Add narratives from the option's then block
        if (result.narratives) {
          for (const narrative of result.narratives) {
            addLine({
              id: 'option-response',
              sender: Sender.NARRATOR,
              text: narrative.text,
            });
          }
        }

        if (result.sceneId === 'END') {
          setState((prev) => ({ ...prev, status: Status.ENDED }));
          return;
        }
        if (result.sceneId) {
          lastProcessedRef.current = null;
          setState({
            currentSceneId: result.sceneId,
            currentLineIdx: result.lineIdx ?? 0,
            status: Status.RUNNING,
          });
        }
      }
    },
    [playthrough.snapshot, sceneMap, currentSceneId, currentLineIdx, variables, addLine],
  );

  // Process replay queue when waiting for input
  useEffect(() => {
    if (status === Status.WAITING && replayQueueRef.current.length > 0) {
      const nextChoice = replayQueueRef.current.shift()!;
      handleReplayMatch(nextChoice);
    }
  }, [status, handleReplayMatch]);

  /* Player actions */
  const handleSubmit = useCallback(
    async (input: string) => {
      if (input === '') {
        input = '(stay silent)';
      }

      // Add the player's line
      addLine({
        id: 'player',
        sender: Sender.PLAYER,
        text: input,
      });

      // Set status to matching while we process the input
      setState((prev) => ({ ...prev, status: Status.MATCHING }));

      // Match input to options and update scene/line position
      const result = await matchInput({
        input,
        schema: playthrough.snapshot,
        sceneMap,
        sceneId: currentSceneId,
        lineIdx: currentLineIdx,
        hasVariable: variables.has,
      });

      if (result.matched) {
        // If fuzzy matched, save the alias back to the script
        if (result.fuzzyMatch && result.optionText) {
          setState((prev) => ({ ...prev, status: Status.GENERATING }));

          const updatedScript = addAliasToOption(
            project.script,
            result.optionText,
            result.fuzzyMatch.suggestedAlias,
          );
          setProject({ script: updatedScript });

          // Add a narrator line showing the fuzzy match info
          addLine({
            id: 'fuzzy-match-info',
            sender: Sender.SYSTEM,
            text: `(Matched "${input}" to "${result.optionText}" with ${Math.round(result.fuzzyMatch.confidence * 100)}% confidence)`,
          });
        }

        // If matched via cached alias, show that info
        if (result.cachedMatch && result.optionText) {
          addLine({
            id: 'cached-match-info',
            sender: Sender.SYSTEM,
            text: `(Matched to "${result.optionText}" from cached alias "${result.cachedMatch.matchedAlias}")`,
          });
        }

        // Process metadata (sets/unsets) from the option's then block
        if (result.metadata) {
          for (const meta of result.metadata) {
            if (meta.key === 'sets') {
              variables.set(meta.value);
            } else if (meta.key === 'unsets') {
              variables.unset(meta.value);
            }
          }
        }

        // Add narratives from the option's `then` block
        if (result.narratives) {
          for (const narrative of result.narratives) {
            addLine({
              id: 'option-response',
              sender: Sender.NARRATOR,
              text: narrative.text,
            });
          }
        }

        if (result.sceneId === 'END') {
          setState((prev) => ({ ...prev, status: Status.ENDED }));
          return;
        }

        if (result.sceneId) {
          // Update position to the matched option's target
          // Reset position tracking before navigating
          lastProcessedRef.current = null;
          setState({
            currentSceneId: result.sceneId,
            currentLineIdx: result.lineIdx ?? 0,
            status: Status.RUNNING,
          });
        }
      } else {
        // No match found - generate a new branch
        setState((prev) => ({ ...prev, status: Status.GENERATING }));

        // Get allows configuration for the current scene
        const allowsConfig = getAllowsForScene({
          schema: playthrough.snapshot,
          sceneMap,
          sceneId: currentSceneId,
        });

        // Get context for generation
        const history = playthrough.lines.map((l) => `${l.sender}: ${l.text}`);
        const options = getOptionsAtPosition({
          schema: playthrough.snapshot,
          sceneMap,
          sceneId: currentSceneId,
          lineIdx: currentLineIdx,
          hasVariable: variables.has,
        });
        const existingOptions = options.map((o) => o.text);

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userInput: input,
              currentScene: currentSceneId,
              history,
              existingOptions,
              projectLines: project.script,
              guidebook: project.guidebook,
              existingScenes: Object.keys(sceneMap),
              allowsConfig,
              currentVariables: variables.getAll(),
            } satisfies GenerateRequest),
          });

          if (!response.ok) throw new Error('Generation failed');

          const data: GenerateResponse = await response.json();

          if (data.success && data.generatedOption) {
            const { text: optionText, aliases, then: thenLines, newScene } = data.generatedOption;
            const generationTitle = data.title; // Short title like "Check key"

            // Capture base schema before applying generation
            const baseSchema = parseIntoSchema(project.script);

            // Update the script with the new option
            let updatedScript = addGeneratedOptionToScript(
              project.script,
              currentSceneId,
              optionText,
              aliases,
              thenLines,
            );

            // If there's a new scene, add it to the script (with new @ syntax)
            if (newScene) {
              updatedScript = [...updatedScript, `@${newScene.label}`, ...newScene.content];
            }

            // Parse generated schema and create branch
            const generatedSchema = parseIntoSchema(updatedScript);
            const branch = createBranch(
              playthrough.id,
              baseSchema,
              generatedSchema,
              project.script,
              generationTitle,
            );

            // Only create/merge branch if there are actual changes
            if (branch.sceneIds.length > 0) {
              addOrMergeBranch(branch, baseSchema, generatedSchema, generationTitle);
            }

            setProject({ script: updatedScript });

            // Update playthrough snapshot immediately so new scenes are available
            setPlaythrough((prev) => ({
              ...prev,
              snapshot: generatedSchema,
            }));

            // Show generation info
            addLine({
              id: 'generated-info',
              sender: Sender.SYSTEM,
              text: `(Generated new path for "${input}")`,
            });

            // Play the narrative lines from the generated option
            for (const line of thenLines) {
              const trimmed = line.trim();
              // Handle goto @SCENE syntax
              if (trimmed.startsWith('goto ')) {
                const target = trimmed.slice(5).trim();
                // Remove @ prefix if present
                const cleanTarget = target.startsWith('@') ? target.slice(1) : target;
                if (cleanTarget === 'END') {
                  setState((prev) => ({ ...prev, status: Status.ENDED }));
                  return;
                }
                // Reset position tracking before jumping to new scene
                lastProcessedRef.current = null;
                setState({
                  currentSceneId: cleanTarget,
                  currentLineIdx: 0,
                  status: Status.RUNNING,
                });
                return;
              } else if (trimmed.length > 0) {
                // Narrative line
                addLine({
                  id: 'generated-narrative',
                  sender: Sender.NARRATOR,
                  text: trimmed,
                });
              }
            }

            // No jump in generated content - loop back to current scene
            // Reset position tracking so we can re-process this position with new options
            lastProcessedRef.current = null;
            setState((prev) => ({ ...prev, status: Status.RUNNING }));
          } else {
            throw new Error(data.error || 'Generation failed');
          }
        } catch {
          addLine({
            id: 'generation-error',
            sender: Sender.NARRATOR,
            text: `Could not generate a response for "${input}". Please try something else.`,
          });
          setState((prev) => ({ ...prev, status: Status.WAITING }));
        }
      }
    },
    [
      playthrough,
      sceneMap,
      currentSceneId,
      currentLineIdx,
      project,
      setProject,
      addOrMergeBranch,
      addLine,
      variables,
    ],
  );

  function handleRestart() {
    // Get the latest schema & copy that
    setPlaythrough({
      ...playthrough,
      snapshot: JSON.parse(JSON.stringify(schema)),
      lines: [],
      createdAt: Date.now(),
    });
    setState({
      status: Status.RUNNING,
      currentSceneId: 'START',
      currentLineIdx: 0,
    });
    variables.reset();
    lastProcessedRef.current = null;
  }

  // Replay from a specific line, starting at the appropriate scene
  // If choiceText is provided, queue it to be selected
  // If preserveVariables is true, keep current variables instead of resetting
  function replay(targetLineIdx: number, choiceText?: string, preserveVariables?: boolean) {
    const targetLine = project.script[targetLineIdx]?.trim();
    let startSceneId = 'START';

    if (targetLine?.startsWith('@')) {
      // Target is a scene - start directly there
      startSceneId = targetLine.slice(1);
      replayQueueRef.current = choiceText ? [choiceText] : [];
    } else {
      // Target is a choice - find which scene it's in and start there
      for (let i = targetLineIdx; i >= 0; i--) {
        const line = project.script[i]?.trim();
        if (line?.startsWith('@')) {
          startSceneId = line.slice(1);
          break;
        }
      }
      // Queue the choice to be selected
      replayQueueRef.current = choiceText ? [choiceText] : [];
    }

    // Restart at the target scene, optionally preserve variables
    setPlaythrough({
      ...playthrough,
      snapshot: JSON.parse(JSON.stringify(schema)),
      lines: [],
      createdAt: Date.now(),
    });
    setState({
      status: Status.RUNNING,
      currentSceneId: startSceneId,
      currentLineIdx: 0,
    });
    if (!preserveVariables) {
      variables.reset();
    }
    lastProcessedRef.current = null;
  }

  // Jump to a specific point in history, slicing lines from there
  function handleJumpTo(historyIdx: number) {
    const slicedLines = playthrough.lines.slice(0, historyIdx);
    setPlaythrough((prev) => ({
      ...prev,
      lines: slicedLines,
    }));

    // Recompute scene/line position from sliced lines
    const newPosition = getSceneAndLineIdx({ lines: slicedLines, sceneMap });
    setState({
      ...newPosition,
      status: Status.RUNNING,
    });
    lastProcessedRef.current = null;
  }

  // Jump back to just before the last player decision
  function handleJumpBack() {
    // Find the last player line
    let lastPlayerIdx = -1;
    for (let i = playthrough.lines.length - 1; i >= 0; i--) {
      if (playthrough.lines[i].sender === Sender.PLAYER) {
        lastPlayerIdx = i;
        break;
      }
    }

    if (lastPlayerIdx > 0) {
      handleJumpTo(lastPlayerIdx);
    } else if (lastPlayerIdx === 0) {
      // If the first line is a player line, just restart
      handleRestart();
    }
    // If no player lines, do nothing
  }

  // Update a specific line's text (for inline editing)
  function updateLineText(lineIdx: number, newText: string) {
    setPlaythrough((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === lineIdx ? { ...line, text: newText } : line)),
    }));
  }

  return {
    status,
    lines: playthrough.lines,
    variables: variables.getAll(),
    setVariable: variables.set,
    unsetVariable: variables.unset,
    hasVariable: variables.has,
    currentSceneId,
    handleNext,
    handleSubmit,
    handleRestart,
    handleJumpTo,
    handleJumpBack,
    replay,
    updateLineText,
  };
}
