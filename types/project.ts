import { Id } from '@/convex/_generated/dataModel';

export type Project = {
  id: Id<'projects'>;
  userId?: Id<'users'>;
  authorId?: string; // Legacy field
  name: string;
  description: string;
  script: string[]; // Parsed into schema
  guidebook: string;
};
