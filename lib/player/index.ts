'use client';

import { GenerateRequest, GenerateResponse } from '@/app/api/generate/route';
import { Line, Playthrough, Sender } from '@/types/playthrough';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProject } from '../project';
import { addAliasToOption, addGeneratedOptionToScript } from '../project/parser';
import {
  constructSceneMap,
  getSceneAndLineIdx,
  isSchemaEditValid,
  matchInput,
  parseLineId,
  step,
} from './utils/index';
import { getOptionsAtPosition } from './utils/matchInput/utils';

export enum Status {
  RUNNING = 'running',
  WAITING = 'waiting',
  MATCHING = 'matching',
  GENERATING = 'generating',
  ENDED = 'ended',
}

export default function usePlayer() {
  const { projectId, schema, project, setProject } = useProject();
  const [playthrough, setPlaythrough] = useState<Playthrough>({
    id: 'abcdef',
    projectId,
    snapshot: JSON.parse(JSON.stringify(schema)), // Copy
    lines: [],
    createdAt: new Date(),
  });

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

  useEffect(() => {
    // Accept any valid changes
    if (isSchemaEditValid({ curr: playthrough.snapshot, diff: schema })) {
      setPlaythrough((prev) => ({
        ...prev,
        snapshot: schema,
      }));
    }
  }, [schema, playthrough.snapshot]);

  // Automatically go next until you can't
  useEffect(() => {
    if (status === Status.RUNNING) {
      handleNext();
    }
  }, [status, handleNext]);

  /* Utilities */
  function addLine(newLine: Line) {
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
  }

  /* Player actions */
  function handleNext() {
    const nextMove = step({
      schema: playthrough.snapshot,
      sceneMap,
      sceneId: currentSceneId,
      lineIdx: currentLineIdx,
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
    }

    if (nextMove.line) {
      addLine(nextMove.line);
    }
  }

  const handleSubmit = useCallback(
    async (input: string) => {
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
          setProject({ ...project, script: updatedScript });

          // Add a narrator line showing the fuzzy match info
          addLine({
            id: 'fuzzy-match-info',
            sender: Sender.NARRATOR,
            text: `(Matched "${input}" to "${result.optionText}" with ${Math.round(result.fuzzyMatch.confidence * 100)}% confidence)`,
          });
        }

        // If matched via cached alias, show that info
        if (result.cachedMatch && result.optionText) {
          addLine({
            id: 'cached-match-info',
            sender: Sender.NARRATOR,
            text: `(Matched to "${result.optionText}" from cached alias "${result.cachedMatch.matchedAlias}")`,
          });
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
          setState({
            currentSceneId: result.sceneId,
            currentLineIdx: result.lineIdx ?? 0,
            status: Status.RUNNING,
          });
        }
      } else {
        // No match found - generate a new branch
        setState((prev) => ({ ...prev, status: Status.GENERATING }));

        // Get context for generation
        const history = playthrough.lines.map((l) => `${l.sender}: ${l.text}`);
        const options = getOptionsAtPosition({
          schema: playthrough.snapshot,
          sceneMap,
          sceneId: currentSceneId,
          lineIdx: currentLineIdx,
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
            } satisfies GenerateRequest),
          });

          if (!response.ok) throw new Error('Generation failed');

          const data: GenerateResponse = await response.json();

          if (data.success && data.generatedOption) {
            const { text: optionText, aliases, then: thenLines } = data.generatedOption;

            // Update the script with the new option
            const updatedScript = addGeneratedOptionToScript(
              project.script,
              currentSceneId,
              optionText,
              aliases,
              thenLines,
            );
            setProject({ ...project, script: updatedScript });

            // Show generation info
            addLine({
              id: 'generated-info',
              sender: Sender.SYSTEM,
              text: `(Generated new path for "${input}")`,
            });

            // Play the narrative lines from the generated option
            for (const line of thenLines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('>')) {
                // This is a jump - handle navigation
                const target = trimmed.slice(1).trim();
                if (target === 'END') {
                  setState((prev) => ({ ...prev, status: Status.ENDED }));
                  return;
                }
                setState({
                  currentSceneId: target,
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
    [playthrough.snapshot, sceneMap, currentSceneId, currentLineIdx, project, setProject],
  );

  function handleRestart() {
    // TODO: Create a new playthrough, don't just replace the existing
    // Get the latest schema & copy that
    setPlaythrough({
      ...playthrough,
      snapshot: JSON.parse(JSON.stringify(schema)),
      lines: [],
      createdAt: new Date(),
    });
    setState({
      status: Status.RUNNING,
      currentSceneId: 'START',
      currentLineIdx: 0,
    });
  }

  return {
    status,
    lines: playthrough.lines,
    handleNext,
    handleSubmit,
    handleRestart,
  };
}
