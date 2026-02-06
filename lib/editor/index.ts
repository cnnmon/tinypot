'use client';

import { api } from '@/convex/_generated/api';
import { Entity } from '@/types/entities';
import { useMutation } from 'convex/react';
import { useCallback, useMemo, useState } from 'react';
import { useProject } from '../project';
import { parseIntoSchema } from '../project/parser';
import { computeBlame, LineBlame } from './blame';

export default function useEditor() {
  const { project, updateProject, versions } = useProject();
  const resolveAllMutation = useMutation(api.versions.resolveAll);
  const [cursorLine, setCursorLine] = useState<number>(0);

  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  // Compute blame for all lines (only unresolved AI versions for highlighting)
  const blame = useMemo(() => {
    return computeBlame(project.script, versions, true);
  }, [project.script, versions]);

  // Check if there are any unresolved AI-authored lines
  const hasUnresolvedAiLines = useMemo(() => {
    return blame.some((b) => b === Entity.SYSTEM);
  }, [blame]);

  // Get blame for the current cursor line
  const currentLineBlame = useMemo((): LineBlame => {
    if (cursorLine < 0 || cursorLine >= blame.length) return null;
    return blame[cursorLine];
  }, [blame, cursorLine]);

  function setScript(newScript: string[]) {
    updateProject({ script: newScript });
  }

  const updateCursorLine = useCallback((line: number) => {
    setCursorLine(line);
  }, []);

  // Dismiss highlights by resolving all versions permanently
  const dismissHighlights = useCallback(() => {
    resolveAllMutation({ projectId: project.id });
  }, [resolveAllMutation, project.id]);

  return {
    script: project.script,
    setScript,
    schema,
    blame,
    cursorLine,
    currentLineBlame,
    updateCursorLine,
    hasUnresolvedAiLines,
    dismissHighlights,
  };
}
