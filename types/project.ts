import { Id } from '@/convex/_generated/dataModel';

export type Project = {
  id: Id<'projects'>;
  authorId: string;
  name: string;
  description: string;
  script: string[]; // Parsed into schema
  guidebook: string;
};
