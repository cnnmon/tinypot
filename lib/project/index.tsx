/**
 * Shared project utilities for both editor & player.
 */

'use client';

import { Project } from '@/types/project';
import { Schema } from '@/types/schema';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { DEFAULT_LINES } from './constants';
import { parseIntoSchema } from './parser';

interface ProjectContextValue {
  projectId: string;
  project: Project;
  setProject: (project: Project) => void;
  schema: Schema;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  children,
  projectId,
}: {
  children: ReactNode;
  projectId: string;
}) {
  const [project, setProject] = useState<Project>({
    id: projectId,
    authorId: 'abcdef',
    name: 'project',
    description: 'blah',
    script: DEFAULT_LINES,
  });

  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  return (
    <ProjectContext.Provider
      value={{
        projectId: project.id,
        project,
        setProject,
        schema,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
