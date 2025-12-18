'use client';

import { Game } from '@/types/games';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

const ProjectContext = createContext<Game | null>(null);

function getProject(_projectId: string): Promise<Game> {
  // return fetch(`/api/projects/${projectId}`).then((res) => res.json());
  return Promise.resolve({
    id: '123',
    authorId: '123',
    name: 'Test Project',
    description: 'Test Description',
    schema: [],
    branches: [],
    playthroughs: [],
  });
}

export function ProjectProvider({
  children,
  projectId,
}: {
  children: ReactNode;
  projectId: string;
}) {
  const [project, setProject] = useState<Game | null>(null);

  useEffect(() => {
    getProject(projectId).then(setProject);
  }, [projectId]);

  if (!project) {
    return null; // or a loading spinner
  }

  return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}
