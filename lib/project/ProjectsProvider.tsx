'use client';

import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_LINES } from './constants';
import { addProjectKey, getProjectKeys, removeProjectKey } from './storage';

interface PublicProject {
  name: string;
  shareId: string;
}

interface ProjectsContextValue {
  projectKeys: string[];
  projects: Doc<'projects'>[];
  publicProjects: PublicProject[];
  isLoading: boolean;
  createProject: () => Promise<Id<'projects'> | undefined>;
  deleteProject: (projectId: Id<'projects'>) => Promise<void>;
  renameProject: (projectId: Id<'projects'>, name: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projectKeys, setProjectKeys] = useState<string[]>([]);
  const createProjectMutation = useMutation(api.projects.create);
  const removeProjectMutation = useMutation(api.projects.remove);
  const updateProjectMutation = useMutation(api.projects.update);

  // Load keys from localStorage on mount
  useEffect(() => {
    setProjectKeys(getProjectKeys());
  }, []);

  // Fetch user's projects
  const allProjects = useQuery(api.projects.list);
  const isLoading = allProjects === undefined;
  const projects = allProjects ?? [];

  // Fetch public projects (with encoded share IDs only)
  const publicProjectsQuery = useQuery(
    api.projects.listPublic,
    projectKeys.length > 0 ? { excludeIds: projectKeys as Id<'projects'>[] } : 'skip',
  );
  const publicProjects = publicProjectsQuery ?? [];

  const addKey = useCallback((projectId: string) => {
    addProjectKey(projectId);
    setProjectKeys(getProjectKeys());
  }, []);

  const removeKey = useCallback((projectId: string) => {
    removeProjectKey(projectId);
    setProjectKeys(getProjectKeys());
  }, []);

  const createProject = async () => {
    try {
      const project = await createProjectMutation({
        authorId: 'default-author',
        name: 'Untitled Project',
        description: '',
        script: DEFAULT_LINES,
        guidebook: '',
      });
      if (project) {
        addKey(project._id);
        window.location.href = `/edit/${project._id}`;
      }
      return project?._id ?? undefined;
    } catch (error) {
      console.error('Failed to create project:', error);
      return undefined;
    }
  };

  const deleteProject = useCallback(
    async (projectId: Id<'projects'>) => {
      await removeProjectMutation({ projectId });
      removeKey(projectId);
    },
    [removeProjectMutation, removeKey],
  );

  const renameProject = useCallback(
    async (projectId: Id<'projects'>, name: string) => {
      await updateProjectMutation({ projectId, name: name ?? 'Untitled Project' });
    },
    [updateProjectMutation],
  );

  return (
    <ProjectsContext.Provider
      value={{
        projectKeys,
        projects,
        publicProjects,
        isLoading,
        createProject,
        deleteProject,
        renameProject,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjectKeys must be used within a ProjectKeysProvider');
  }
  return context;
}
