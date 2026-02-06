import { Version } from '@/types/version';

/**
 * Get before/after scripts for diff viewing.
 * Compares the selected version to its predecessor.
 */
export function getDiffScripts(
  selectedVersionId: string | null,
  versions: Version[],
): { before: string[]; after: string[] } | null {
  if (!selectedVersionId) return null;

  const versionIdx = versions.findIndex((v) => v.id === selectedVersionId);
  if (versionIdx === -1) return null;

  const selectedVersion = versions[versionIdx];
  // Versions are sorted desc (newest first), so "before" is the next item in array
  const previousVersion = versions[versionIdx + 1];

  return {
    before: previousVersion?.snapshot.script ?? [],
    after: selectedVersion.snapshot.script,
  };
}
