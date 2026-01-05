'use client';

import { useMemo } from 'react';
import { useProject } from '../project';
import { parseIntoSchema } from '../project/parser';

export default function useEditor() {
  const { project, setProject } = useProject();

  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  function setScript(newScript: string[]) {
    setProject({ script: newScript });
  }

  return {
    script: project.script,
    setScript,
    schema,
  };
}
