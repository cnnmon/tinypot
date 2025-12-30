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

  const [branches, setBranches] = useState<Branch[]>(() => loadBranches(projectId));
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

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
      setBranches((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== branchId) return b;
          const authored = captureAuthoredScenes(b, schema);
          return { ...b, authored, approved: true };
        });
        saveBranches(projectId, updated);
        return updated;
      });
      setSelectedBranchId(null);
    },
    [projectId, schema],
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

      setBranches((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== branchId) return b;
          const authored = shouldRevert ? new Map(b.base) : captureAuthoredScenes(b, schema);
          return { ...b, authored, approved: false };
        });
        saveBranches(projectId, updated);
        return updated;
      });
      setSelectedBranchId(null);
    },
    [branches, project, projectId, schema, setProject],
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
