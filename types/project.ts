/**
 * Types for projects.
 */

export type Project = {
  id: string;
  authorId: string;
  name: string;
  description: string;
  script: string[]; // Parsed into schema
};
