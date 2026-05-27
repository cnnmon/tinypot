'use client';

import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import { DEFAULT_LINES } from './constants';

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
  const { isAuthenticated, isLoading: isLoadingUser, userId } = useCurrentUser();
  const { signIn } = useAuthActions();
  const createProjectMutation = useMutation(api.projects.create);
  const removeProjectMutation = useMutation(api.projects.remove);
  const updateProjectMutation = useMutation(api.projects.update);

  // Fetch account-owned projects
  const allProjects = useQuery(api.projects.listMine, {});
  const projects = allProjects ?? [];
  const projectKeys = projects.map((project) => project._id);
  const isLoading = isLoadingUser || (isAuthenticated && allProjects === undefined);

  // Fetch public projects (excluding current account-owned project IDs)
  const publicProjectsQuery = useQuery(api.projects.listPublic, {
    excludeIds: projectKeys as Id<'projects'>[],
  });
  const publicProjects = publicProjectsQuery ?? [];

  const createProject = async () => {
    if (isLoadingUser) return undefined;
    if (!isAuthenticated || !userId) {
      await signIn('google');
      return undefined;
    }

    try {
      const project = await createProjectMutation({
        name: 'Untitled Project',
        description: '',
        script: DEFAULT_LINES,
        guidebook: '',
      });
      if (project) {
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
      if (!userId) return;
      await removeProjectMutation({ projectId });
    },
    [removeProjectMutation, userId],
  );

  const renameProject = useCallback(
    async (projectId: Id<'projects'>, name: string) => {
      if (!userId) return;
      await updateProjectMutation({ projectId, name: name ?? 'Untitled Project' });
    },
    [updateProjectMutation, userId],
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
