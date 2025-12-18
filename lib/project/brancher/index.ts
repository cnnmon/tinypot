/**
 * Brancher - handles schema diffing and branch creation logic.
 * Branches represent changes from a base schema to a resolved schema.
 */

import { Schema, SchemaLine } from '@/types/schema';
import { Branch, BranchStatus } from '@/types/versions';

export interface SchemaDiff {
  divergeAt: number;
  hasChanges: boolean;
  added: SchemaLine[];
  removed: SchemaLine[];
}

/**
 * Compares two schemas and returns where they diverge.
 */
export function diffSchemas(baseSchema: Schema, newSchema: Schema): SchemaDiff {
  let divergeAt = 0;

  // Find first point of divergence
  const minLen = Math.min(baseSchema.length, newSchema.length);
  for (let i = 0; i < minLen; i++) {
    if (JSON.stringify(baseSchema[i]) !== JSON.stringify(newSchema[i])) {
      divergeAt = i;
      break;
    }
    divergeAt = i + 1;
  }

  // If we reached the end of one schema, divergence is at the shorter length
  if (divergeAt === minLen && baseSchema.length !== newSchema.length) {
    divergeAt = minLen;
  }

  const hasChanges = JSON.stringify(baseSchema) !== JSON.stringify(newSchema);
  const removed = baseSchema.slice(divergeAt);
  const added = newSchema.slice(divergeAt);

  return { divergeAt, hasChanges, added, removed };
}

/**
 * Checks if two schemas are identical.
 */
export function schemasEqual(a: Schema, b: Schema): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Creates a branch data structure from base and resolved schemas.
 */
export function createBranchData(
  baseSchema: Schema,
  resolvedSchema: Schema,
  status: BranchStatus = BranchStatus.APPROVED
): Omit<Branch, 'id'> {
  return {
    status,
    baseSchema,
    resolvedSchema,
  };
}

/**
 * Applies a branch to get the resolved schema.
 * (Currently just returns resolvedSchema, but could be more complex with patches)
 */
export function applyBranch(branch: Branch): Schema {
  return branch.resolvedSchema;
}

/**
 * Checks if a branch can be applied to a given base schema.
 * Returns true if the branch's base matches the given schema.
 */
export function canApplyBranch(branch: Branch, currentSchema: Schema): boolean {
  return schemasEqual(branch.baseSchema, currentSchema);
}

/**
 * Attempts to merge a branch with a modified schema.
 * Returns null if merge is not possible (conflicting changes).
 */
export function mergeBranch(branch: Branch, currentSchema: Schema): Schema | null {
  // If current schema matches branch base, just apply it
  if (canApplyBranch(branch, currentSchema)) {
    return applyBranch(branch);
  }

  // If current schema already matches resolved, nothing to do
  if (schemasEqual(branch.resolvedSchema, currentSchema)) {
    return currentSchema;
  }

  // Find common prefix between all three
  const baseDiff = diffSchemas(branch.baseSchema, currentSchema);
  const branchDiff = diffSchemas(branch.baseSchema, branch.resolvedSchema);

  // If changes are in different areas, we can merge
  // (Simple case: branch changes are after current changes, or vice versa)
  if (baseDiff.divergeAt >= branch.baseSchema.length && branchDiff.divergeAt >= branch.baseSchema.length) {
    // Both added to the end - concatenate
    return [...currentSchema, ...branchDiff.added];
  }

  // For now, return null for complex merges
  return null;
}

