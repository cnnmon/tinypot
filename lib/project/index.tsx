/**
 * Shared project utilities for both editor & player.
 */

'use client';

import {
  captureAuthoredScenes,
  computeSceneToBranchMap,
  isResolved,
  mergeBranchChanges,
  SceneId,
} from '@/lib/branch';
import { addBranch, loadBranches, saveBranches, updateBranch } from '@/lib/db/branches';
import { updateGuidebook as saveGuidebook } from '@/lib/db/projects';
import { runJob } from '@/lib/jobs';
import { runMetalearning } from '@/lib/jobs/metalearning';
import { Branch } from '@/types/branch';
import { Project } from '@/types/project';
import { Schema } from '@/types/schema';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_LINES } from './constants';
import { parseIntoSchema } from './parser';

interface ProjectContextValue {
  projectId: string;
  project: Project;
  setProject: (project: Project) => void;
  schema: Schema;
  // Branch state
  branches: Branch[];
  unresolvedBranches: Branch[];
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  sceneToBranchMap: Map<SceneId, string>;
  // Branch actions
  addOrMergeBranch: (branch: Branch, baseSchema: Schema, generatedSchema: Schema) => void;
  approveBranch: (branchId: string) => void;
  rejectBranch: (branchId: string, shouldRevert: boolean) => void;
  // Guidebook state
  guidebook: string;
  setGuidebook: (guidebook: string) => void;
  isGuidebookUpdating: boolean;
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
    guidebook: '',
  });

  const [branches, setBranches] = useState<Branch[]>(() => loadBranches(projectId));
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [guidebook, setGuidebookState] = useState('');
  const [isGuidebookUpdating, setIsGuidebookUpdating] = useState(false);

  // Guidebook setter that also persists
  const setGuidebook = useCallback(
    (newGuidebook: string) => {
      setGuidebookState(newGuidebook);
      saveGuidebook(projectId, newGuidebook);
    },
    [projectId],
  );

  // Kick off metalearning job after branch resolution
  const startMetalearningJob = useCallback(
    (resolvedBranch: Branch) => {
      setIsGuidebookUpdating(true);

      runJob(
        `metalearning-${resolvedBranch.id}`,
        () => runMetalearning(projectId, resolvedBranch),
        {
          onComplete: (result) => {
            // Append metalearning to guidebook
            setGuidebookState((prev) => {
              const entry = prev ? `${prev}\n${result.metalearning}` : result.metalearning;
              saveGuidebook(projectId, entry);
              return entry;
            });
            // Update branch in state with metalearning
            setBranches((prev) =>
              prev.map((b) =>
                b.id === resolvedBranch.id ? { ...b, metalearning: result.metalearning } : b,
              ),
            );
            setIsGuidebookUpdating(false);
          },
          onError: (error) => {
            console.error('Metalearning failed:', error);
            setIsGuidebookUpdating(false);
          },
        },
      );
    },
    [projectId],
  );

  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  // Update branches if projectId changes
  useEffect(() => {
    setBranches(loadBranches(projectId));
  }, [projectId]);

  // Compute unresolved branches
  const unresolvedBranches = useMemo(() => {
    return branches.filter((b) => !isResolved(b));
  }, [branches]);

  // Compute scene-to-branch mapping for highlighting
  const sceneToBranchMap = useMemo(() => {
    return computeSceneToBranchMap(unresolvedBranches);
  }, [unresolvedBranches]);

  // Add or merge branch - one branch per playthrough
  const addOrMergeBranch = useCallback(
    (branch: Branch, baseSchema: Schema, generatedSchema: Schema) => {
      // Check if there's already an unresolved branch for this playthrough
      const existingBranch = branches.find(
        (b) => b.playthroughId === branch.playthroughId && !isResolved(b),
      );

      if (existingBranch) {
        // Merge new changes into existing branch
        const mergedBranch = mergeBranchChanges(existingBranch, baseSchema, generatedSchema);
        updateBranch(projectId, existingBranch.id, mergedBranch);
        setBranches((prev) => prev.map((b) => (b.id === existingBranch.id ? mergedBranch : b)));
        setSelectedBranchId(existingBranch.id);
      } else {
        // Create new branch
        addBranch(projectId, branch);
        setBranches((prev) => [...prev, branch]);
        setSelectedBranchId(branch.id);
      }
    },
    [projectId, branches],
  );

  // Approve branch - capture authored scenes and mark as approved
  const approveBranch = useCallback(
    (branchId: string) => {
      let resolvedBranch: Branch | null = null;
      setBranches((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== branchId) return b;
          const authored = captureAuthoredScenes(b, schema);
          resolvedBranch = { ...b, authored, approved: true };
          return resolvedBranch;
        });
        saveBranches(projectId, updated);
        return updated;
      });
      setSelectedBranchId(null);
      // Kick off metalearning
      if (resolvedBranch) {
        startMetalearningJob(resolvedBranch);
      }
    },
    [projectId, schema, startMetalearningJob],
  );

  // Reject branch - optionally revert to base scenes
  const rejectBranch = useCallback(
    (branchId: string, shouldRevert: boolean) => {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return;

      if (shouldRevert) {
        // Revert script to base scenes
        // This is a simplified approach - reconstruct affected lines
        const updatedScript = [...project.script];

        for (const sceneId of branch.sceneIds) {
          const baseScene = branch.base.get(sceneId);
          // Find scene in script and replace its content
          // For now, just mark as rejected without full revert
          // (Full revert requires reconstructing script from schema)
          console.log('Reverting scene', sceneId, 'to base:', baseScene);
        }

        setProject({ ...project, script: updatedScript });
      }

      let resolvedBranch: Branch | null = null;
      setBranches((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== branchId) return b;
          const authored = shouldRevert ? new Map(b.base) : captureAuthoredScenes(b, schema);
          resolvedBranch = { ...b, authored, approved: false };
          return resolvedBranch;
        });
        saveBranches(projectId, updated);
        return updated;
      });
      setSelectedBranchId(null);
      // Kick off metalearning
      if (resolvedBranch) {
        startMetalearningJob(resolvedBranch);
      }
    },
    [branches, project, projectId, schema, setProject, startMetalearningJob],
  );

  return (
    <ProjectContext.Provider
      value={{
        projectId: project.id,
        project,
        setProject,
        schema,
        branches,
        unresolvedBranches,
        selectedBranchId,
        setSelectedBranchId,
        sceneToBranchMap,
        addOrMergeBranch,
        approveBranch,
        rejectBranch,
        guidebook,
        setGuidebook,
        isGuidebookUpdating,
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
