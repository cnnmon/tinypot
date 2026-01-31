'use client';

import { useMemo, useState, useCallback } from 'react';
import { useProject } from '../project';
import { parseIntoSchema } from '../project/parser';
import { computeBlame, LineBlame } from './blame';

export default function useEditor() {
  const { project, updateProject, versions } = useProject();
  const [cursorLine, setCursorLine] = useState<number>(0);

  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  // Compute blame for all lines
  const blame = useMemo(() => {
    return computeBlame(project.script, versions);
  }, [project.script, versions]);

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

  return {
    script: project.script,
    setScript,
    schema,
    blame,
    cursorLine,
    currentLineBlame,
    updateCursorLine,
  };
}
