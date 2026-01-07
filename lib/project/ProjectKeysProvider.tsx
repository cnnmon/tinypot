'use client';

import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { addProjectKey, getProjectKeys, removeProjectKey } from './storage';

interface ProjectKeysContextValue {
  projectKeys: string[];
  projects: Doc<'projects'>[];
  addKey: (projectId: string) => void;
  removeKey: (projectId: string) => void;
}

const ProjectKeysContext = createContext<ProjectKeysContextValue | null>(null);

export function ProjectKeysProvider({ children }: { children: ReactNode }) {
  const [projectKeys, setProjectKeys] = useState<string[]>([]);

  // Load keys from localStorage on mount
  useEffect(() => {
    setProjectKeys(getProjectKeys());
  }, []);

  // Fetch full project data for all keys
  const projectIds = useMemo(() => projectKeys.map((k) => k as Id<'projects'>), [projectKeys]);
  const projectsData = useQuery(
    api.projects.listByIds,
    projectIds.length > 0 ? { projectIds } : 'skip',
  );
  const projects = projectsData ?? [];

  const addKey = useCallback((projectId: string) => {
    addProjectKey(projectId);
    setProjectKeys(getProjectKeys());
  }, []);

  const removeKey = useCallback((projectId: string) => {
    removeProjectKey(projectId);
    setProjectKeys(getProjectKeys());
  }, []);

  return (
    <ProjectKeysContext.Provider value={{ projectKeys, projects, addKey, removeKey }}>
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
