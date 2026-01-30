'use client';

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { twMerge } from 'tailwind-merge';

interface VersionHistoryProps {
  versions: Version[];
  currentSnapshot: { script: string[]; guidebook: string };
  saveStatus: 'idle' | 'saving' | 'saved';
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
}

/** Format relative time (e.g., "2m ago", "1h ago") */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

/** Extract scene names from a script */
function getSceneNames(script: string[]): Set<string> {
  const scenes = new Set<string>();
  for (const line of script) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      scenes.add(trimmed.slice(1).trim());
    }
  }
  return scenes;
}

/** Describe what changed between two snapshots */
function describeChanges(
  current: { script: string[]; guidebook: string },
  previous: { script: string[]; guidebook: string } | null,
): string {
  if (!previous) {
    const scenes = getSceneNames(current.script);
    if (scenes.size === 0) return 'created';
    return `added ${Array.from(scenes).slice(0, 2).join(', ')}`;
  }

  const currentScenes = getSceneNames(current.script);
  const previousScenes = getSceneNames(previous.script);

  // Find added scenes
  const added: string[] = [];
  for (const scene of currentScenes) {
    if (!previousScenes.has(scene)) {
      added.push(scene);
    }
  }

  // Find edited scenes (scenes that exist in both but have different content)
  const edited: string[] = [];
  for (const scene of currentScenes) {
    if (previousScenes.has(scene)) {
      // Simple check: if overall script changed and scene exists in both, it might be edited
      if (current.script.join('\n') !== previous.script.join('\n')) {
        edited.push(scene);
      }
    }
  }

  // Build description
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`+${added.slice(0, 2).join(', ')}`);
  }
  if (edited.length > 0 && added.length === 0) {
    // Only show edited if nothing was added (to keep it short)
    parts.push(`~${edited.slice(0, 1).join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'edited';
}

/** Check if two snapshots have identical content */
function snapshotsEqual(
  a: { script: string[]; guidebook: string },
  b: { script: string[]; guidebook: string },
): boolean {
  return a.script.join('\n') === b.script.join('\n') && a.guidebook === b.guidebook;
}

// 1 hour session window for coalescing versions
const SESSION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Coalesce consecutive versions by the same creator within a session (1 hour),
 * and filter out versions with no content changes from the previous.
 * Returns a simplified list for display.
 */
export function coalesceVersions(versions: Version[], windowMs = SESSION_WINDOW_MS): Version[] {
  if (versions.length === 0) return [];

  // First pass: filter out versions with identical content to previous
  const dedupedVersions: Version[] = [versions[0]];
  for (let i = 1; i < versions.length; i++) {
    const prev = dedupedVersions[dedupedVersions.length - 1];
    const curr = versions[i];
    // Keep if content differs from previous kept version
    if (!snapshotsEqual(prev.snapshot, curr.snapshot)) {
      dedupedVersions.push(curr);
    }
  }

  if (dedupedVersions.length === 0) return [];

  // Second pass: coalesce by creator and time window
  const result: Version[] = [];
  let current = dedupedVersions[0];

  for (let i = 1; i < dedupedVersions.length; i++) {
    const v = dedupedVersions[i];
    const timeDiff = current.createdAt - v.createdAt;

    // Coalesce if same creator and within time window
    if (v.creator === current.creator && timeDiff < windowMs) {
      continue;
    }

    result.push(current);
    current = v;
  }

  result.push(current);
  return result;
}

export default function VersionHistory({
  versions,
  currentSnapshot,
  saveStatus,
  selectedVersionId,
  onSelectVersion,
}: VersionHistoryProps) {
  // Build version items with change descriptions
  // Include current state as the first item if it differs from latest version
  const hasUnsavedChanges = versions.length === 0 || !snapshotsEqual(currentSnapshot, versions[0].snapshot);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Save status indicator */}
      <div className="flex items-center justify-between">
        <h1 className="cursor-default">versions</h1>
        <span
          className={twMerge(
            'text-xs transition-opacity',
            saveStatus === 'saving' && 'text-neutral-500 animate-pulse',
            saveStatus === 'saved' && 'text-green-600',
            saveStatus === 'idle' && 'opacity-0',
          )}
        >
          {saveStatus === 'saving' ? 'saving...' : saveStatus === 'saved' ? 'saved' : ''}
        </span>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-auto space-y-1 text-sm">
        {/* Current unsaved state (only if different from latest version) */}
        {hasUnsavedChanges && (
          <button
            onClick={() => onSelectVersion(null)}
            className={twMerge(
              'w-full text-left px-2 py-1 hover:bg-[var(--mint)]/50',
              selectedVersionId === null && 'bg-[var(--mint)]',
            )}
          >
            <span className="text-neutral-400">unsaved</span>
          </button>
        )}

        {/* Saved versions with change descriptions */}
        {versions.map((version, idx) => {
          const previousVersion = versions[idx + 1] ?? null;
          const changeDesc = describeChanges(version.snapshot, previousVersion?.snapshot ?? null);
          const isAI = version.creator === Entity.SYSTEM;

          return (
            <button
              key={version.id}
              onClick={() => onSelectVersion(version.id)}
              className={twMerge(
                'w-full text-left px-2 py-1 hover:bg-[var(--mint)]/50',
                selectedVersionId === version.id ? 'bg-[var(--mint)]' : '',
              )}
            >
              <span className="text-neutral-400">{formatRelativeTime(version.createdAt)}</span>
              <span className="text-neutral-300 mx-1">/</span>
              <span className={isAI ? 'text-orange-600' : 'text-neutral-700'}>{isAI ? 'ai' : 'you'}</span>
              <span className="text-neutral-400 ml-1">({changeDesc})</span>
            </button>
          );
        })}

        {versions.length === 0 && !hasUnsavedChanges && (
          <p className="text-neutral-400 px-2">no versions yet</p>
        )}
      </div>
    </div>
  );
}
