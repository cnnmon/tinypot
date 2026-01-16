/**
 * Shared project utilities for both editor & player.
 */

'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  captureAuthoredScenes,
  computeSceneToBranchMap,
  isResolved,
  mergeBranchChanges,
  recordsEqual,
} from '@/lib/branch';
import { runJob } from '@/lib/jobs';
import { MetalearningResult, runMetalearning } from '@/lib/jobs/metalearning';
import { Branch, SceneId } from '@/types/branch';
import { Schema } from '@/types/schema';
import { useMutation, useQuery } from 'convex/react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_LINES } from './constants';
import { parseIntoSchema } from './parser';

// Branch with Convex ID
interface ConvexBranch extends Branch {
  _id: Id<'branches'>;
}

interface ProjectContextValue {
  projectId: Id<'projects'>;
  project: {
    id: string;
    authorId: string;
    name: string;
    description: string;
    script: string[];
    guidebook: string;
  };
  setProject: (updates: { name?: string; script?: string[]; guidebook?: string }) => void;
  recordGuidebookChanges: (oldGuidebook: string, newGuidebook: string) => void;
  schema: Schema;

  // Branch state
  branches: ConvexBranch[];
  unresolvedBranches: ConvexBranch[];
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  sceneToBranchMap: Record<SceneId, string>;

  // Branch actions
  addOrMergeBranch: (branch: Branch, baseSchema: Schema, generatedSchema: Schema) => void;
  approveBranch: (branchId: string) => void;
  rejectBranch: (branchId: string, shouldRevert: boolean) => void;
  isMetalearning: boolean;

  // Player reset trigger - changes when player should reset
  playerResetKey: number;

  // Read-only mode (for play page)
  readOnly: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  children,
  projectId,
  readOnly = false,
}: {
  children: ReactNode;
  projectId: Id<'projects'>;
  readOnly?: boolean;
}) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isMetalearning, setIsMetalearning] = useState(false);
  const [playerResetKey, setPlayerResetKey] = useState(0);

  // Convex mutations
  const updateProjectMutation = useMutation(api.projects.update);
  const createBranchMutation = useMutation(api.branches.create);
  const updateBranchMutation = useMutation(api.branches.update);
  const createGuidebookChangeMutation = useMutation(api.guidebookChanges.create);
  const createManyGuidebookChangesMutation = useMutation(api.guidebookChanges.createMany);

  // Convex queries
  const convexProject = useQuery(api.projects.get, { projectId });
  const convexBranches = useQuery(api.branches.list, { projectId });

  // Local state for optimistic updates
  const [localScript, setLocalScript] = useState<string[] | null>(null);
  const [localGuidebook, setLocalGuidebook] = useState<string | null>(null);

  // Derive project from Convex data or defaults
  const project = useMemo(() => {
    return {
      id: projectId,
      authorId: convexProject?.authorId ?? 'default-author',
      name: convexProject?.name ?? 'My Project',
      description: convexProject?.description ?? '',
      script: localScript ?? convexProject?.script ?? DEFAULT_LINES,
      guidebook: localGuidebook ?? convexProject?.guidebook ?? '',
    };
  }, [convexProject, projectId, localScript, localGuidebook]);

  const guidebook = project.guidebook;

  // Update project (name, script, or guidebook)
  const setProject = useCallback(
    (updates: { name?: string; script?: string[]; guidebook?: string }) => {
      // Skip mutations in read-only mode
      if (readOnly) return;

      // Optimistic update for script and guidebook
      if (updates.script !== undefined) setLocalScript(updates.script);
      if (updates.guidebook !== undefined) setLocalGuidebook(updates.guidebook);

      // Persist to Convex
      updateProjectMutation({
        projectId,
        ...updates,
      });
    },
    [projectId, updateProjectMutation, readOnly],
  );

  // Record guidebook changes for analytics (call on blur with baseline value)
  const recordGuidebookChanges = useCallback(
    (oldGuidebook: string, newGuidebook: string) => {
      if (readOnly) return;
      if (oldGuidebook === newGuidebook) return;

      const oldLines = oldGuidebook
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const newLines = newGuidebook
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Compute changes
      type Change = {
        action: 'add' | 'update' | 'delete';
        rule: string;
        previousRule?: string;
      };
      const changes: Change[] = [];

      // Find deleted and updated rules
      for (const oldRule of oldLines) {
        if (!newLines.includes(oldRule)) {
          // Check if it was updated (fuzzy match by position or similarity)
          const oldIdx = oldLines.indexOf(oldRule);
          if (oldIdx < newLines.length && !oldLines.includes(newLines[oldIdx])) {
            // Rule at same position changed - likely an update
            changes.push({ action: 'update', rule: newLines[oldIdx], previousRule: oldRule });
          } else {
            changes.push({ action: 'delete', rule: oldRule });
          }
        }
      }

      // Find added rules (not in old, not already marked as update target)
      const updateTargets = new Set(
        changes.filter((c) => c.action === 'update').map((c) => c.rule),
      );
      for (const newRule of newLines) {
        if (!oldLines.includes(newRule) && !updateTargets.has(newRule)) {
          changes.push({ action: 'add', rule: newRule });
        }
      }

      // Record changes if any
      if (changes.length > 0) {
        createManyGuidebookChangesMutation({
          projectId,
          changes,
          source: 'manual',
        });
      }
    },
    [createManyGuidebookChangesMutation, projectId, readOnly],
  );

  // Schema from project script
  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  // Convert Convex branches to our Branch type
  const branches: ConvexBranch[] = useMemo(() => {
    if (!convexBranches) return [];
    return convexBranches.map((b) => ({
      _id: b._id,
      id: b._id, // Use Convex ID as the branch ID
      title: b.title,
      playthroughId: b.playthroughId,
      sceneIds: b.sceneIds,
      base: b.base as Branch['base'],
      generated: b.generated as Branch['generated'],
      authored: b.authored as Branch['authored'],
      baseScript: b.baseScript,
      approved: b.approved,
      metalearning: b.metalearning,
      createdAt: b.createdAt,
    }));
  }, [convexBranches]);

  // Compute unresolved branches
  const unresolvedBranches = useMemo(() => {
    return branches.filter((b) => !isResolved(b));
  }, [branches]);

  // Compute scene-to-branch mapping for highlighting
  const sceneToBranchMap = useMemo(() => {
    return computeSceneToBranchMap(unresolvedBranches);
  }, [unresolvedBranches]);

  // Kick off metalearning job after branch resolution
  const startMetalearningJob = useCallback(
    (resolvedBranch: ConvexBranch) => {
      setIsMetalearning(true);

      runJob(
        `metalearning-${resolvedBranch.id}`,
        () => runMetalearning(resolvedBranch._id, resolvedBranch, guidebook),
        {
          onComplete: (result: MetalearningResult) => {
            // Use the intelligently updated guidebook
            setProject({ guidebook: result.updatedGuidebook });

            // Update branch with the new rule (for display)
            updateBranchMutation({
              branchId: resolvedBranch._id,
              metalearning: result.newRule || '',
            });

            // Record guidebook change for analytics
            if (result.action !== 'none' && result.newRule) {
              createGuidebookChangeMutation({
                projectId,
                branchId: resolvedBranch._id,
                action: result.action,
                rule: result.newRule,
                previousRule: result.previousRule,
                source: 'metalearning',
              });
            }

            setIsMetalearning(false);
          },
          onError: (error) => {
            console.error('Metalearning failed:', error);
            setIsMetalearning(false);
          },
        },
      );
    },
    [guidebook, setProject, updateBranchMutation, createGuidebookChangeMutation, projectId],
  );

  // Add or merge branch - one branch per playthrough
  const addOrMergeBranch = useCallback(
    (branch: Branch, baseSchema: Schema, generatedSchema: Schema, generationTitle?: string) => {
      if (readOnly) return;

      // Check if there's already an unresolved branch for this playthrough
      const existingBranch = branches.find(
        (b) => b.playthroughId === branch.playthroughId && !isResolved(b),
      );

      if (existingBranch) {
        // Merge new changes into existing branch (concatenates titles)
        const mergedBranch = mergeBranchChanges(
          existingBranch,
          baseSchema,
          generatedSchema,
          generationTitle,
        );
        updateBranchMutation({
          branchId: existingBranch._id,
          title: mergedBranch.title,
          sceneIds: mergedBranch.sceneIds,
          base: mergedBranch.base,
          generated: mergedBranch.generated,
        });
        setSelectedBranchId(existingBranch.id);
      } else {
        // Create new branch
        createBranchMutation({
          projectId,
          playthroughId: branch.playthroughId,
          title: branch.title,
          sceneIds: branch.sceneIds,
          base: branch.base,
          generated: branch.generated,
          baseScript: branch.baseScript,
          createdAt: branch.createdAt,
        }).then((newBranch) => {
          if (newBranch) {
            setSelectedBranchId(newBranch._id);
          }
        });
      }
    },
    [projectId, branches, updateBranchMutation, createBranchMutation, readOnly],
  );

  // Approve branch - capture authored scenes and mark as approved
  const approveBranch = useCallback(
    (branchId: string) => {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return;

      const authored = captureAuthoredScenes(branch, schema);

      updateBranchMutation({
        branchId: branch._id,
        authored,
        approved: true,
      });

      setSelectedBranchId(null);

      // Only run metalearning if there are meaningful edits (authored differs from generated)
      const hasMeaningfulEdits = !recordsEqual(authored, branch.generated);
      if (hasMeaningfulEdits) {
        startMetalearningJob({ ...branch, authored, approved: true });
      }
    },
    [branches, schema, updateBranchMutation, startMetalearningJob],
  );

  // Delete branch - optionally discard to base script
  // Rejects NEVER trigger metalearning (only accept with edits does)
  const rejectBranch = useCallback(
    (branchId: string, shouldRevert: boolean) => {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return;

      if (shouldRevert && branch.baseScript) {
        // Revert to original script before generation
        setProject({ script: branch.baseScript });
      }

      const authored = shouldRevert ? { ...branch.base } : captureAuthoredScenes(branch, schema);

      updateBranchMutation({
        branchId: branch._id,
        authored,
        approved: false,
      });

      setSelectedBranchId(null);

      // Reset the player
      setPlayerResetKey((k) => k + 1);
    },
    [branches, schema, setProject, updateBranchMutation],
  );

  // Show loading state while project data is loading
  if (convexProject === undefined) {
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
        projectId,
        project,
        setProject,
        recordGuidebookChanges,
        schema,
        branches,
        unresolvedBranches,
        selectedBranchId,
        setSelectedBranchId,
        sceneToBranchMap,
        addOrMergeBranch,
        approveBranch,
        rejectBranch,
        isMetalearning,
        playerResetKey,
        readOnly,
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
