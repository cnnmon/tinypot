/**
 * Branch storage using localStorage.
 * Will be replaced by Convex.
 */

import { Branch } from '@/types/branch';

const STORAGE_KEY = 'bonsai_branches';

interface BranchStorage {
  [projectId: string]: Branch[];
}

function getStorage(): BranchStorage {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

function setStorage(storage: BranchStorage): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function loadBranches(projectId: string): Branch[] {
  const storage = getStorage();
  return storage[projectId] || [];
}

export function saveBranches(projectId: string, branches: Branch[]): void {
  const storage = getStorage();
  storage[projectId] = branches;
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
