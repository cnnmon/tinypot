/**
 * Shared project utilities for both editor & player.
 */

'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Branch } from '@/types/branch';
import { Entity } from '@/types/entities';
import { Project } from '@/types/project';
import { Version } from '@/types/version';
import { useMutation, useQuery } from 'convex/react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_LINES } from './constants';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface ProjectContextValue {
  project: Project;
  updateProject: (updates: Partial<Project>, creator?: Entity.AUTHOR | Entity.SYSTEM) => void;
  versions: Version[];
  saveStatus: SaveStatus;
  selectedVersionId: string | null;
  setSelectedVersionId: (id: string | null) => void;
  /** Get the diff scripts for a selected version: [before, after] */
  getDiffScripts: () => { before: string[]; after: string[] } | null;
  // Legacy branch fields (empty stubs for Editor compatibility)
  branches: Branch[];
  sceneToBranchMap: Record<string, string>;
  selectedBranchId: string | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

// Debounce delay for creating versions (ms)
const VERSION_DEBOUNCE_MS = 2000;

export function ProjectProvider({ children, projectId }: { children: ReactNode; projectId: Id<'projects'> }) {
  // Convex queries
  const convexProject = useQuery(api.projects.get, { projectId });
  // @ts-expect-error - versions module may not be in generated types yet
  const convexVersions = useQuery(api.versions?.list, { projectId }) as
    | { _id: Id<'versions'>; creator: string; createdAt: number; snapshot: { script: string[]; guidebook: string } }[]
    | undefined;
  const updateProjectMutation = useMutation(api.projects.update);
  // @ts-expect-error - versions module may not be in generated types yet
  const createVersionMutation = useMutation(api.versions?.create) as
    | ((args: {
        projectId: Id<'projects'>;
        creator: string;
        snapshot: { script: string[]; guidebook: string };
      }) => Promise<unknown>)
    | undefined;

  // Save status for UI feedback
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const versionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSnapshotRef = useRef<{ script: string[]; guidebook: string } | null>(null);

  // Selected version for diff viewing
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Local project state - only initialize AFTER convexProject is loaded
  // This prevents the DEFAULT_LINES from ever being used when we have real data
  const [project, setProject] = useState<{
    authorId: string;
    name: string;
    description: string;
    script: string[];
    guidebook: string;
  } | null>(null);

  // Sync from Convex when data arrives
  useEffect(() => {
    if (convexProject) {
      setProject({
        authorId: convexProject.authorId,
        name: convexProject.name,
        description: convexProject.description,
        script: convexProject.script,
        guidebook: convexProject.guidebook,
      });
    }
  }, [convexProject]);

  // Initialize lastSavedSnapshot from most recent version or current project
  useEffect(() => {
    if (lastSavedSnapshotRef.current) return; // Already initialized
    if (convexVersions && convexVersions.length > 0) {
      lastSavedSnapshotRef.current = convexVersions[0].snapshot;
    } else if (convexProject) {
      lastSavedSnapshotRef.current = { script: convexProject.script, guidebook: convexProject.guidebook };
    }
  }, [convexVersions, convexProject]);

  // Transform Convex versions to our Version type
  const versions: Version[] = (convexVersions ?? []).map((v) => ({
    id: v._id,
    creator: v.creator as Entity.AUTHOR | Entity.SYSTEM,
    createdAt: v.createdAt,
    snapshot: v.snapshot,
  }));

  // Track pending creator for debounced version creation
  const pendingCreatorRef = useRef<Entity.AUTHOR | Entity.SYSTEM>(Entity.AUTHOR);

  // Update project with debounced version creation
  const updateProject = useCallback(
    (updates: Partial<Project>, creator: Entity.AUTHOR | Entity.SYSTEM = Entity.AUTHOR) => {
      const newProject = { ...project, ...updates };
      setProject(newProject);
      pendingCreatorRef.current = creator;

      // Show saving status
      setSaveStatus('saving');

      // Clear existing timeouts
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);

      // Debounce the actual save
      saveTimeoutRef.current = setTimeout(() => {
        updateProjectMutation({
          projectId,
          ...newProject,
        });
        setSaveStatus('saved');

        // Reset to idle after a bit
        setTimeout(() => setSaveStatus('idle'), 1500);
      }, 300);

      // Debounce version creation (longer delay)
      versionTimeoutRef.current = setTimeout(() => {
        const snapshot = { script: newProject.script, guidebook: newProject.guidebook };
        const lastSnapshot = lastSavedSnapshotRef.current;

        // Only create version if content actually changed
        if (
          !lastSnapshot ||
          lastSnapshot.script.join('\n') !== snapshot.script.join('\n') ||
          lastSnapshot.guidebook !== snapshot.guidebook
        ) {
          createVersionMutation?.({
            projectId,
            creator: pendingCreatorRef.current,
            snapshot,
          });
          lastSavedSnapshotRef.current = snapshot;
        }
      }, VERSION_DEBOUNCE_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, projectId, updateProjectMutation],
  );

  // Get diff scripts for selected version: compare previous version to this one
  const getDiffScripts = useCallback((): { before: string[]; after: string[] } | null => {
    if (!selectedVersionId) return null;
    const versionIdx = versions.findIndex((v) => v.id === selectedVersionId);
    if (versionIdx === -1) return null;

    const selectedVersion = versions[versionIdx];
    // Versions are sorted desc (newest first), so "before" is the next item in array
    const previousVersion = versions[versionIdx + 1];

    return {
      before: previousVersion?.snapshot.script ?? [],
      after: selectedVersion.snapshot.script,
    };
  }, [selectedVersionId, versions]);

  // Show loading state while project data is loading
  if (convexProject === undefined || project === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-neutral-400">loading project...</p>
      </div>
    );
  }

  // Show invalid state if project doesn't exist
  if (convexProject === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-neutral-400">Invalid project ID</p>
      </div>
    );
  }

  return (
    <ProjectContext.Provider
      value={{
        project: {
          id: projectId,
          ...project,
        },
        updateProject,
        versions,
        saveStatus,
        selectedVersionId,
        setSelectedVersionId,
        getDiffScripts,
        // Legacy branch fields (empty stubs for Editor compatibility)
        branches: [],
        sceneToBranchMap: {},
        selectedBranchId: null,
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

export function useProjectOptional() {
  return useContext(ProjectContext);
}
