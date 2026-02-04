'use client';

import { GenerateRequest, GenerateResponse } from '@/app/api/generate/route';
import { Id } from '@/convex/_generated/dataModel';
import { Entity } from '@/types/entities';
import { Line, Playthrough } from '@/types/playthrough';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProject } from '../project';
import { addAliasToOption, addGeneratedOptionToScript, parseIntoSchema } from '../project/parser';
import { useVariables } from './useVariables';
import { constructSceneMap, getSceneAndLineIdx, matchInput, parseLineId, processGlobalPreamble, step } from './utils';
import { getAllowsForScene, getOptionsAtPosition } from './utils/matchInput/utils';

/**
 * Extract all variable names used in the script (+var, -var, ?var, when var)
 */
function extractProjectVariables(script: string[]): string[] {
  const variables = new Set<string>();
  for (const line of script) {
    const trimmed = line.trim();
    // +var or -var
    const setUnset = trimmed.match(/^[+-](\w+)$/);
    if (setUnset) variables.add(setUnset[1].toLowerCase());
    // & ?var (requires)
    const requires = trimmed.match(/&\s*\?(\w+)/);
    if (requires) variables.add(requires[1].toLowerCase());
    // when var or when !var or when var >= N
    const when = trimmed.match(/^when\s+!?(\w+)/);
    if (when) variables.add(when[1].toLowerCase());
  }
  return Array.from(variables);
}

export enum Status {
  RUNNING = 'running',
  WAITING = 'waiting',
  MATCHING = 'matching',
  GENERATING = 'generating',
  ENDED = 'ended',
}

/**
 * Core player hook - handles playthrough state and player interactions.
 *
 * Schema changes to note:
 * - Using `versions` table instead of `branches` for tracking changes
 * - Version has `snapshot: Pick<Project, 'script' | 'guidebook'>`
 * - useProject returns `{ project, updateProject, versions }`
 */
export default function usePlayer() {
  const { project, updateProject } = useProject();
  const variables = useVariables();

  const schema = useMemo(() => parseIntoSchema(project.script), [project.script]);
  const sceneMap = useMemo(() => constructSceneMap({ schema }), [schema]);

  const [playthrough, setPlaythrough] = useState<Playthrough>({
    id: 'temp' as Id<'playthroughs'>,
    projectId: project.id as string,
    lines: [],
    createdAt: Date.now(),
    versionId: 'temp' as Id<'versions'>,
  });

  const [state, setState] = useState(() => ({
    ...getSceneAndLineIdx({ lines: [], sceneMap }),
    status: Status.RUNNING,
  }));

  const { currentSceneId, currentLineIdx, status } = state;

  // Add a line to the playthrough
  const addLine = useCallback((newLine: Line) => {
    setPlaythrough((prev) => ({
      ...prev,
      lines: [...prev.lines, newLine],
    }));

    const parsedId = parseLineId(newLine.id);
    if (parsedId) {
      setState((prev) => ({
        ...prev,
        currentSceneId: parsedId.sceneId,
        currentLineIdx: parsedId.lineIdx + 1,
      }));
    }
  }, []);

  // Step through the script automatically until we hit a wait or end
  const handleNext = useCallback(() => {
    let sceneId = currentSceneId;
    let lineIdx = currentLineIdx;
    const newLines: Line[] = [];
    let maxSteps = 100; // Safety limit

    while (maxSteps-- > 0) {
      const nextMove = step({
        schema,
        sceneMap,
        sceneId,
        lineIdx,
        callbacks: {
          setVariable: variables.set,
          unsetVariable: variables.unset,
          hasVariable: variables.has,
        },
      });

      if (nextMove.type === 'wait') {
        // Add all collected lines, then set to waiting
        newLines.forEach(addLine);
        setState((prev) => ({
          ...prev,
          status: Status.WAITING,
          currentSceneId: sceneId,
          currentLineIdx: lineIdx,
        }));
        return;
      } else if (nextMove.type === 'end') {
        newLines.forEach(addLine);
        setState((prev) => ({ ...prev, status: Status.ENDED }));
        return;
      } else if (nextMove.type === 'error') {
        newLines.forEach(addLine);
        if (nextMove.line) addLine(nextMove.line);
        setState((prev) => ({ ...prev, status: Status.WAITING }));
        return;
      } else if (nextMove.line) {
        newLines.push(nextMove.line);
        const parsedId = parseLineId(nextMove.line.id);
        if (parsedId) {
          sceneId = parsedId.sceneId;
          lineIdx = parsedId.lineIdx + 1;
        }
      }
    }

    // If we hit the safety limit, just wait
    newLines.forEach(addLine);
    setState((prev) => ({ ...prev, status: Status.WAITING }));
  }, [schema, sceneMap, currentSceneId, currentLineIdx, variables, addLine]);

  // Run next automatically
  useEffect(() => {
    if (status === Status.RUNNING) {
      handleNext();
    }
  }, [handleNext, status]);
    
  // Handle player input
  const handleSubmit = useCallback(
    async (input: string) => {
      // Auto-increment turn counter on each player input
      variables.set('turn');

      // Check global preamble conditions after turn increments
      const preambleResult = processGlobalPreamble(schema, variables.has, false);

      const trimmedInput = input || '(stay silent)';
      let lineIdx = state.currentLineIdx;

      // Add the player's line FIRST
      addLine({
        id: `${currentSceneId}-${lineIdx}` as `${string}-${number}`,
        sender: Entity.PLAYER,
        text: trimmedInput,
      });

      // Then show preamble narratives (if any) AFTER player input
      if (preambleResult.narratives.length > 0) {
        addLine({
          id: `preamble-${Date.now()}` as `${string}-${number}`,
          sender: Entity.AUTHOR,
          text: preambleResult.narratives.join(' '),
        });
      }
      
      // Handle preamble jump (e.g., when turn >= 20 -> goto @END)
      if (preambleResult.jumpTarget) {
        if (preambleResult.jumpTarget === 'END') {
          setState((prev) => ({ ...prev, status: Status.ENDED }));
          return;
        }
        // Jump to another scene
        setState({
          currentSceneId: preambleResult.jumpTarget,
          currentLineIdx: 0,
          status: Status.RUNNING,
        });
        return;
      }

      setState((prev) => ({ ...prev, status: Status.MATCHING }));

      // Try to match input to existing options
      const result = await matchInput({
        input: trimmedInput,
        schema,
        sceneMap,
        sceneId: currentSceneId,
        lineIdx,
        hasVariable: variables.has,
      });

      if (result.matched) {
        // Handle fuzzy match - save alias
        if (result.fuzzyMatch && result.optionText) {
          const updatedScript = addAliasToOption(project.script, result.optionText, result.fuzzyMatch.suggestedAlias);
          updateProject({ script: updatedScript });
        }

        // Process metadata (sets/unsets)
        if (result.metadata) {
          for (const meta of result.metadata) {
            if (meta.key === 'sets') variables.set(meta.value);
            else if (meta.key === 'unsets') variables.unset(meta.value);
          }
        }

        // Add narratives from the option
        if (result.narratives) {
          for (const narrative of result.narratives) {
            lineIdx++;
            addLine({
              id: `${currentSceneId}-${lineIdx}` as `${string}-${number}`,
              sender: Entity.AUTHOR,
              text: narrative.text,
            });
          }
        }

        if (result.sceneId === 'END') {
          setState((prev) => ({ ...prev, status: Status.ENDED }));
          return;
        }

        if (result.sceneId) {
          setState({
            currentSceneId: result.sceneId,
            currentLineIdx: result.lineIdx ?? 0,
            status: Status.RUNNING,
          });
        }
      } else {
        // No match - generate new content
        await handleGenerate(trimmedInput, lineIdx);
      }
    },
    [state, currentSceneId, schema, sceneMap, project, updateProject, variables, addLine],
  );

  // Generate new content when no match found
  const handleGenerate = useCallback(
    async (input: string, lineIdx: number) => {
      setState((prev) => ({ ...prev, status: Status.GENERATING }));

      const allowsConfig = getAllowsForScene({ schema, sceneMap, sceneId: currentSceneId });
      const history = playthrough.lines.map((l) => `${l.sender}: ${l.text}`);
      const options = getOptionsAtPosition({
        schema,
        sceneMap,
        sceneId: currentSceneId,
        lineIdx,
        hasVariable: variables.has,
      });

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userInput: input,
            currentScene: currentSceneId,
            history,
            existingOptions: options.map((o) => o.text),
            projectLines: project.script,
            guidebook: project.guidebook,
            existingScenes: Object.keys(sceneMap),
            allowsConfig,
            currentVariables: variables.getAll(),
            projectVariables: extractProjectVariables(project.script),
          } satisfies GenerateRequest),
        });

        if (!response.ok) throw new Error('Generation failed');

        const data: GenerateResponse = await response.json();

        if (data.success && data.generatedOption) {
          const { text: optionText, aliases, then: thenLines, newScene } = data.generatedOption;

          // Update script with new option
          let updatedScript = addGeneratedOptionToScript(
            project.script,
            currentSceneId,
            optionText,
            aliases,
            thenLines,
          );

          // Add new scene if generated
          if (newScene) {
            updatedScript = [...updatedScript, `@${newScene.label}`, ...newScene.content];
          }

          updateProject({ script: updatedScript }, Entity.SYSTEM);

          // Show generation info
          addLine({
            id: `${currentSceneId}-${lineIdx + 1}` as `${string}-${number}`,
            sender: Entity.SYSTEM,
            text: `(Generated new path for "${input}")`,
          });

          // Play through generated content
          for (const line of thenLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('goto ')) {
              const target = trimmed.slice(5).trim().replace(/^@/, '');
              if (target === 'END') {
                setState((prev) => ({ ...prev, status: Status.ENDED }));
                return;
              }
              setState({ currentSceneId: target, currentLineIdx: 0, status: Status.RUNNING });
              return;
            } else if (trimmed.length > 0) {
              addLine({
                id: `${currentSceneId}-${++lineIdx}` as `${string}-${number}`,
                sender: Entity.AUTHOR,
                text: trimmed,
              });
            }
          }

          setState((prev) => ({ ...prev, status: Status.RUNNING }));
        } else {
          throw new Error(data.error || 'Generation failed');
        }
      } catch {
        addLine({
          id: `${currentSceneId}-${lineIdx + 1}` as `${string}-${number}`,
          sender: Entity.SYSTEM,
          text: `(Could not generate a response for "${input}". Please try something else.)`,
        });
        setState((prev) => ({ ...prev, status: Status.WAITING }));
      }
    },
    [schema, sceneMap, currentSceneId, playthrough.lines, project, updateProject, variables, addLine],
  );

  // Restart the playthrough
  const handleRestart = useCallback(() => {
    setPlaythrough((prev) => ({
      ...prev,
      lines: [],
      createdAt: Date.now(),
    }));
    setState({ status: Status.RUNNING, currentSceneId: 'START', currentLineIdx: 0 });
    variables.reset();
  }, [variables]);

  // Jump back (undo last action) - simplified version that restarts for now
  const handleJumpBack = useCallback(() => {
    // For now, just restart - a full implementation would track history
    handleRestart();
  }, [handleRestart]);

  return {
    status,
    lines: playthrough.lines,
    variables: variables.getAll(),
    currentSceneId,
    handleNext,
    handleSubmit,
    handleRestart,
    handleJumpBack,
  };
}
