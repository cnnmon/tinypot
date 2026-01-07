'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { addProjectKey, getProjectKeys, removeProjectKey } from './storage';

interface ProjectKeysContextValue {
  projectKeys: string[];
  addKey: (projectId: string) => void;
  removeKey: (projectId: string) => void;
}

const ProjectKeysContext = createContext<ProjectKeysContextValue | null>(null);

export function ProjectKeysProvider({ children }: { children: ReactNode }) {
  const [projectKeys, setProjectKeys] = useState<string[]>([]);

  // Load once on mount
  useEffect(() => {
    setProjectKeys(getProjectKeys());
  }, []);

  const addKey = useCallback((projectId: string) => {
    addProjectKey(projectId);
    setProjectKeys(getProjectKeys());
  }, []);

  const removeKey = useCallback((projectId: string) => {
    removeProjectKey(projectId);
    setProjectKeys(getProjectKeys());
  }, []);

  return (
    <ProjectKeysContext.Provider value={{ projectKeys, addKey, removeKey }}>
      {children}
    </ProjectKeysContext.Provider>
  );
}

export function useProjectKeys() {
  const context = useContext(ProjectKeysContext);
  if (!context) {
    throw new Error('useProjectKeys must be used within a ProjectKeysProvider');
  }
  return context;
}

