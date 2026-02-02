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
import { detectFeedbackFromVersions, formatGuidebookFeedback } from '../version/feedback';

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
  /** Delete a version by ID */
  deleteVersion: (versionId: string) => void;
  // Legacy branch fields (empty stubs for Editor compatibility)
  branches: Branch[];
  sceneToBranchMap: Record<string, string>;
  selectedBranchId: string | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

// Session window for coalescing author versions (1 hour)
const SESSION_WINDOW_MS = 60 * 60 * 1000;

export function ProjectProvider({ children, projectId }: { children: ReactNode; projectId: Id<'projects'> }) {
  // Convex queries
  const convexProject = useQuery(api.projects.get, { projectId });
  const convexVersions = useQuery(api.versions?.list, { projectId }) as
    | { _id: Id<'versions'>; creator: string; createdAt: number; updatedAt?: number; snapshot: { script: string[]; guidebook: string } }[]
    | undefined;
  const updateProjectMutation = useMutation(api.projects.update);
  const createVersionMutation = useMutation(api.versions?.create) as
    | ((args: {
        projectId: Id<'projects'>;
        creator: string;
        snapshot: { script: string[]; guidebook: string };
      }) => Promise<unknown>)
    | undefined;
  const updateVersionMutation = useMutation(api.versions?.update) as
    | ((args: {
        versionId: Id<'versions'>;
        snapshot: { script: string[]; guidebook: string };
      }) => Promise<unknown>)
    | undefined;
  const deleteVersionMutation = useMutation(api.versions?.remove) as
    | ((args: { versionId: Id<'versions'> }) => Promise<void>)
    | undefined;

  // Save status for UI feedback
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const versionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track pending version state locally (to avoid stale Convex data during rapid typing)
  const pendingVersionRef = useRef<{
    versionId: Id<'versions'> | null;
    creator: Entity.AUTHOR | Entity.SYSTEM;
    updatedAt: number;
  } | null>(null);

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

  // Track if we've saved the initial version
  const hasCreatedInitialVersionRef = useRef(false);

  // Initialize and save initial version if none exists (using AUTHOR, not SYSTEM)
  useEffect(() => {
    // Skip if already created or versions are still loading
    if (hasCreatedInitialVersionRef.current || convexVersions === undefined) return;

    if (convexVersions.length === 0 && convexProject) {
      // No versions exist - create the initial version as AUTHOR
      const snapshot = { script: convexProject.script, guidebook: convexProject.guidebook };
      hasCreatedInitialVersionRef.current = true;
      createVersionMutation?.({
        projectId,
        creator: Entity.AUTHOR,
        snapshot,
      });
    }
  }, [convexVersions, convexProject, projectId, createVersionMutation]);

  // Transform Convex versions to our Version type
  const versions: Version[] = (convexVersions ?? []).map((v) => ({
    id: v._id,
    creator: v.creator as Entity.AUTHOR | Entity.SYSTEM,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    snapshot: v.snapshot,
  }));

  // Helper to check if snapshots are equal
  const snapshotsEqual = useCallback(
    (a: { script: string[]; guidebook: string }, b: { script: string[]; guidebook: string }) => {
      return a.script.join('\n') === b.script.join('\n') && a.guidebook === b.guidebook;
    },
    [],
  );

  // Track version IDs we've already processed for feedback to avoid duplicates
  const processedFeedbackRef = useRef<Set<string>>(new Set());

  // Update project with smart version management
  const updateProject = useCallback(
    (updates: Partial<Project>, creator: Entity.AUTHOR | Entity.SYSTEM = Entity.AUTHOR) => {
      const newProject = { ...project, ...updates };
      setProject(newProject as Project);

      // Show saving status
      setSaveStatus('saving');

      // Clear existing save timeout
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      // Debounce project save (to DB)
      saveTimeoutRef.current = setTimeout(() => {
        updateProjectMutation({
          projectId,
          ...newProject,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      }, 300);

      // Version saving - immediate for AI, debounced+coalesced for author
      const snapshot = { script: newProject.script, guidebook: newProject.guidebook } as {
        script: string[];
        guidebook: string;
      };
      const latestVersion = versions[0];

      // Skip if content is identical to latest version
      if (latestVersion && snapshotsEqual(snapshot, latestVersion.snapshot)) {
        return;
      }

      if (creator === Entity.SYSTEM) {
        // AI edits: create new version immediately (already checked for identical content above)
        createVersionMutation?.({ projectId, creator, snapshot });
        // Reset pending state since AI creates new version
        pendingVersionRef.current = null;
      } else {
        // Author edits: debounce and coalesce
        if (versionTimeoutRef.current) clearTimeout(versionTimeoutRef.current);

        versionTimeoutRef.current = setTimeout(() => {
          const now = Date.now();

          // Use local pending state OR fall back to Convex version
          const pending = pendingVersionRef.current;
          const lastUpdated = pending?.updatedAt ?? latestVersion?.updatedAt ?? latestVersion?.createdAt ?? 0;

          const canCoalesce =
            (pending?.versionId || latestVersion) &&
            (pending?.creator === Entity.AUTHOR || latestVersion?.creator === Entity.AUTHOR) &&
            now - lastUpdated < SESSION_WINDOW_MS;

          if (canCoalesce && updateVersionMutation && (pending?.versionId || latestVersion?.id)) {
            // Update the existing version
            const versionId = pending?.versionId ?? latestVersion!.id;
            updateVersionMutation({ versionId, snapshot });
            // Update pending state
            pendingVersionRef.current = { versionId, creator: Entity.AUTHOR, updatedAt: now };
          } else {
            // Create new version
            createVersionMutation?.({ projectId, creator, snapshot })?.then((result) => {
              // Track the new version locally
              if (result && typeof result === 'object' && '_id' in result) {
                pendingVersionRef.current = {
                  versionId: (result as { _id: Id<'versions'> })._id,
                  creator: Entity.AUTHOR,
                  updatedAt: now,
                };
              }
            });

            // Check for AI→Author feedback pattern if creating a new author version
            // after an AI version (latestVersion is AI, new version is author)
            if (latestVersion?.creator === Entity.SYSTEM) {
              const feedbackKey = `${latestVersion.id}`;
              if (!processedFeedbackRef.current.has(feedbackKey)) {
                processedFeedbackRef.current.add(feedbackKey);

                // Build virtual "new author version" for comparison
                const virtualAuthorVersion: Version = {
                  id: 'pending' as Id<'versions'>,
                  creator: Entity.AUTHOR as Entity.AUTHOR,
                  createdAt: now,
                  snapshot,
                };

                const feedback = detectFeedbackFromVersions([virtualAuthorVersion, latestVersion]);
                if (feedback?.type) {
                  // Append feedback to guidebook
                  const feedbackText = formatGuidebookFeedback(feedback.type, feedback.branch);
                  const updatedGuidebook = newProject.guidebook
                    ? `${newProject.guidebook}\n${feedbackText}`
                    : feedbackText;

                  // Save guidebook update as a separate version
                  createVersionMutation?.({
                    projectId,
                    creator: Entity.SYSTEM,
                    snapshot: { script: newProject.script as string[], guidebook: updatedGuidebook },
                  });

                  // Update local state
                  setProject((prev) => (prev ? { ...prev, guidebook: updatedGuidebook } : prev));
                }
              }
            }
          }
        }, 500); // Debounce version saves by 500ms
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, projectId, updateProjectMutation, versions, snapshotsEqual],
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

  // Delete a version
  const deleteVersion = useCallback(
    (versionId: string) => {
      if (!deleteVersionMutation) return;
      // Clear selection if deleting the selected version
      if (selectedVersionId === versionId) {
        setSelectedVersionId(null);
      }
      deleteVersionMutation({ versionId: versionId as Id<'versions'> });
    },
    [deleteVersionMutation, selectedVersionId],
  );

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
        deleteVersion,
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
