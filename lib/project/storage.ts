/**
 * Local storage utilities for project keys.
 */

const PROJECT_KEYS_STORAGE = 'PROJECT_KEYS';

/**
 * Convex IDs are base64-like strings, typically 20+ chars.
 * Filter out invalid legacy IDs like "123".
 */
function isValidConvexId(id: string): boolean {
  // Convex IDs are longer than simple strings and contain specific characters
  return id.length > 10 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export function getProjectKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(PROJECT_KEYS_STORAGE);
  if (!data) return [];

  const keys: string[] = JSON.parse(data);
  // Filter out invalid legacy IDs
  const validKeys = keys.filter(isValidConvexId);

  // If we filtered some out, update localStorage
  if (validKeys.length !== keys.length) {
    localStorage.setItem(PROJECT_KEYS_STORAGE, JSON.stringify(validKeys));
  }

  return validKeys;
}

export function addProjectKey(projectId: string): void {
  if (typeof window === 'undefined') return;
  const keys = getProjectKeys();
  if (!keys.includes(projectId)) {
    keys.push(projectId);
    localStorage.setItem(PROJECT_KEYS_STORAGE, JSON.stringify(keys));
  }
}

export function removeProjectKey(projectId: string): void {
  if (typeof window === 'undefined') return;
  const keys = getProjectKeys().filter((k) => k !== projectId);
  localStorage.setItem(PROJECT_KEYS_STORAGE, JSON.stringify(keys));
}

export function getCurrentProjectKey(): string | null {
  const keys = getProjectKeys();
  return keys.length > 0 ? keys[0] : null;
}
