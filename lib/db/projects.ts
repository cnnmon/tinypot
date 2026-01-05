/**
 * Mock database operations for Projects using localStorage.
 * Will be replaced by Convex.
 */

import { Project } from '@/types/project';

const GAMES_KEY = 'bonsai_projects';

function getProjectsFromStorage(): Project[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(GAMES_KEY);
  return data ? JSON.parse(data) : [];
}

function saveProjectsToStorage(projects: Project[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GAMES_KEY, JSON.stringify(projects));
}

export async function getProject(projectId: string): Promise<Project | null> {
  const projects = getProjectsFromStorage();
  return projects.find((g) => g.id === projectId) || null;
}

export async function getOrCreateProject(projectId: string, defaults: Project): Promise<Project> {
  const existing = await getProject(projectId);
  if (existing) return existing;

  const projects = getProjectsFromStorage();
  const newProject: Project = {
    id: projectId,
    authorId: defaults.authorId,
    name: defaults.name,
    description: defaults.description,
    script: defaults.script,
    guidebook: defaults.guidebook,
  };
  projects.push(newProject);
  saveProjectsToStorage(projects);
  return newProject;
}

export async function getAllProjects(): Promise<Project[]> {
  return getProjectsFromStorage();
}

export async function createProject(
  name: string,
  description: string,
  authorId: string,
  script: string[] = [],
): Promise<Project> {
  const projects = getProjectsFromStorage();
  const newProject: Project = {
    id: crypto.randomUUID(),
    authorId,
    name,
    description,
    script,
    guidebook: '',
  };
  projects.push(newProject);
  saveProjectsToStorage(projects);
  return newProject;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Project>,
): Promise<Project | null> {
  const projects = getProjectsFromStorage();
  const idx = projects.findIndex((g) => g.id === projectId);
  if (idx === -1) return null;
  projects[idx] = { ...projects[idx], ...updates };
  saveProjectsToStorage(projects);
  return projects[idx];
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const projects = getProjectsFromStorage();
  const filtered = projects.filter((g) => g.id !== projectId);
  if (filtered.length === projects.length) return false;
  saveProjectsToStorage(filtered);
  return true;
}
