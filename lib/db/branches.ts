/**
 * Branch storage using localStorage.
 * Handles Map serialization/deserialization.
 */

import { Branch } from '@/types/branch';
import { SchemaEntry } from '@/types/schema';

const STORAGE_KEY = 'bonsai_branches';

type SceneId = string;
type Scene = SchemaEntry[];

interface SerializedBranch {
  id: string;
  title: string;
  playthroughId: string;
  sceneIds: string[];
  base: Record<string, Scene>;
  generated: Record<string, Scene>;
  authored?: Record<string, Scene>;
  approved?: boolean;
  createdAt: string;
}

interface BranchStorage {
  [projectId: string]: SerializedBranch[];
}

function serializeBranch(branch: Branch): SerializedBranch {
  return {
    id: branch.id,
    title: branch.title,
    playthroughId: branch.playthroughId,
    sceneIds: branch.sceneIds,
    base: Object.fromEntries(branch.base),
    generated: Object.fromEntries(branch.generated),
    authored: branch.authored ? Object.fromEntries(branch.authored) : undefined,
    approved: branch.approved,
    createdAt: branch.createdAt.toISOString(),
  };
}

function deserializeBranch(data: SerializedBranch): Branch {
  return {
    id: data.id,
    title: data.title,
    playthroughId: data.playthroughId,
    sceneIds: data.sceneIds,
    base: new Map(Object.entries(data.base)) as Map<SceneId, Scene>,
    generated: new Map(Object.entries(data.generated)) as Map<SceneId, Scene>,
    authored: data.authored
      ? (new Map(Object.entries(data.authored)) as Map<SceneId, Scene>)
      : undefined,
    approved: data.approved,
    createdAt: new Date(data.createdAt),
  };
}

function getStorage(): BranchStorage {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem(STORAGE_KEY);
  //return data ? JSON.parse(data) : {};
  return {};
}

function setStorage(storage: BranchStorage): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function loadBranches(projectId: string): Branch[] {
  const storage = getStorage();
  const serialized = storage[projectId] || [];
  return serialized.map(deserializeBranch);
}

export function saveBranches(projectId: string, branches: Branch[]): void {
  const storage = getStorage();
  storage[projectId] = branches.map(serializeBranch);
  setStorage(storage);
}

export function addBranch(projectId: string, branch: Branch): void {
  const branches = loadBranches(projectId);
  branches.push(branch);
  saveBranches(projectId, branches);
}

export function updateBranch(projectId: string, branchId: string, updates: Partial<Branch>): void {
  const branches = loadBranches(projectId);
  const idx = branches.findIndex((b) => b.id === branchId);
  if (idx === -1) return;
  branches[idx] = { ...branches[idx], ...updates };
  saveBranches(projectId, branches);
}

export function deleteBranch(projectId: string, branchId: string): void {
  const branches = loadBranches(projectId);
  const filtered = branches.filter((b) => b.id !== branchId);
  saveBranches(projectId, filtered);
}

export function getBranch(projectId: string, branchId: string): Branch | null {
  const branches = loadBranches(projectId);
  return branches.find((b) => b.id === branchId) || null;
}
