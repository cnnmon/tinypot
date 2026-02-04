/**
 * Make branch & guidebook traces ligthweight.
 * We can track any edits to the project between author & system. If the editor is modified by the author, for example, store that project version under "author". Or if the guidebook is updated by the system, store that version under "system".
 * Then in frontend, coalesce versions and display them as needed. For example, it would be helpful to know for each line in editor who edited it last - author or system? for easy metalearning
 */

import { Id } from '@/convex/_generated/dataModel';
import { Entity } from './entities';
import { Project } from './project';

export interface Version {
  id: Id<'versions'>;
  creator: Entity.AUTHOR | Entity.SYSTEM;
  createdAt: number;
  updatedAt?: number; // When the version was last updated (for coalescing)
  resolved?: boolean; // Whether AI changes have been reviewed/dismissed
  snapshot: Pick<Project, 'script' | 'guidebook'>;
}
