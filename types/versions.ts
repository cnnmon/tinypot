/**
 * Types for schema version history, where each contribution is a "branch".
 * Each branch is reviewed, edited, and/or rejected by the author.
 */

import { Schema, SchemaLine } from './schema';

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
  patches: {
    insertAt: number; // line index related to baseSchema
    content: SchemaLine[];
  }[];
  resolvedSchema: Schema; // after resolving patches
}
