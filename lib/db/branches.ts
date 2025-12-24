/**
 * Mock database operations for Branches using localStorage.
 * Replace with actual API calls when ready.
 */

import { Branch, BranchStatus } from '@/types/branch';
import { Schema } from '@/types/schema';

const BRANCHES_KEY = 'bonsai_branches';

function getBranchesFromStorage(): Branch[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(BRANCHES_KEY);
  // return data ? JSON.parse(data) : [];
  return [];
}

function saveBranchesToStorage(branches: Branch[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
}

export async function getBranch(branchId: string): Promise<Branch | null> {
  const branches = getBranchesFromStorage();
  return branches.find((b) => b.id === branchId) || null;
}

export async function getBranchesForGame(branchIds: string[]): Promise<Branch[]> {
  const branches = getBranchesFromStorage();
  return branches.filter((b) => branchIds.includes(b.id));
}

export async function createBranch(baseSchema: Schema, resolvedSchema: Schema): Promise<Branch> {
  const branches = getBranchesFromStorage();

  const newBranch: Branch = {
    id: crypto.randomUUID(),
    projectId: '123',
    status: BranchStatus.APPROVED,
    base: baseSchema,
    generated: resolvedSchema,
  };
  branches.push(newBranch);
  saveBranchesToStorage(branches);
  return newBranch;
}

export async function updateBranchStatus(
  branchId: string,
  status: BranchStatus,
): Promise<Branch | null> {
  const branches = getBranchesFromStorage();
  const idx = branches.findIndex((b) => b.id === branchId);
  if (idx === -1) return null;
  branches[idx] = { ...branches[idx], status };
  saveBranchesToStorage(branches);
  return branches[idx];
}

export async function deleteBranch(branchId: string): Promise<boolean> {
  const branches = getBranchesFromStorage();
  const filtered = branches.filter((b) => b.id !== branchId);
  if (filtered.length === branches.length) return false;
  saveBranchesToStorage(filtered);
  return true;
}
