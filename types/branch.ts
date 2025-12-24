/**
 * Types for schema version history.
 * If a playthrough generates new content,
 * create a branch for the author to review.
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
  projectId: string;
  status: BranchStatus;
  base: Schema; // schema before the branch was created
  generated: Schema; // schema after generated content
  edited?: Schema; // schema after author edits
}
