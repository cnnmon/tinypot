/**
 * Types for schema version history, where each contribution is a "branch".
 * Each branch is reviewed, edited, and/or rejected by the author.
 */

import { Schema } from './schema';

export enum BranchStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

type Timestamp = string;
export type BranchHistory = Record<Timestamp, Schema>;

export interface Branch {
  id: string;
  status: BranchStatus;
  baseSchema: Schema; // before additions
  resolvedSchema: Schema; // after additions
}
