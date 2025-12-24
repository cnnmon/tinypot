'use client';

import { Line, Playthrough, Sender } from '@/types/playthrough';
import { useEffect, useMemo, useState } from 'react';
import { useProject } from '../project';
import {
  constructSceneMap,
  getSceneAndLineIdx,
  handleInput,
  isSchemaEditValid,
  parseLineId,
  step,
} from './utils/index';

export enum Status {
  RUNNING = 'running',
  WAITING = 'waiting',
  ENDED = 'ended',
}

export default function usePlayer() {
  const { projectId, schema } = useProject();
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

  function handleSubmit(input: string) {
    // Add the player's line
    addLine({
      id: 'player',
      sender: Sender.PLAYER,
      text: input,
    });

    // Match input to options and update scene/line position
    const result = handleInput({
      input,
      schema: playthrough.snapshot,
      sceneMap,
      sceneId: currentSceneId,
      lineIdx: currentLineIdx,
    });

    if (result.matched) {
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
        setState({
          ...state,
          status: Status.ENDED,
        });
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
    }
  }

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
