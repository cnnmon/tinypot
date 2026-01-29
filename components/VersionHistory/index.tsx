'use client';

import { Entity } from '@/types/entities';
import { Version } from '@/types/version';
import { useRef } from 'react';
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

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
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

/**
 * Smart coalesce: only coalesce versions that existed on page load.
 * New versions added during the session are shown individually.
 * Also filters out versions identical to current.
 */
function useSmartCoalesce(
  versions: Version[],
  currentSnapshot: { script: string[]; guidebook: string },
): Version[] {
  // Capture version IDs present on initial mount
  const initialIdsRef = useRef<Set<string> | null>(null);
  if (initialIdsRef.current === null) {
    initialIdsRef.current = new Set(versions.map((v) => v.id));
  }

  const initialIds = initialIdsRef.current;

  // Filter out versions that match current state
  const filteredVersions = versions.filter((v) => !snapshotsEqual(v.snapshot, currentSnapshot));

  // Split into initial versions (coalesce these) and new versions (show individually)
  const initialVersions = filteredVersions.filter((v) => initialIds.has(v.id));
  const newVersions = filteredVersions.filter((v) => !initialIds.has(v.id));

  // Coalesce only the initial versions, show new ones as-is
  const coalescedInitial = coalesceVersions(initialVersions);
  return [...newVersions, ...coalescedInitial];
}

export default function VersionHistory({
  versions,
  currentSnapshot,
  saveStatus,
  selectedVersionId,
  onSelectVersion,
}: VersionHistoryProps) {
  const coalesced = useSmartCoalesce(versions, currentSnapshot);
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
      <div className="flex-1 overflow-auto space-y-1">
        {/* Current (live) option */}
        <button
          onClick={() => onSelectVersion(null)}
          className={twMerge(
            'w-full text-left px-2 py-1 hover:bg-[var(--mint)]/50',
            selectedVersionId === null && 'bg-[var(--mint)]',
          )}
        >
          <span className="text-neutral-700">current</span>
        </button>

        {coalesced.map((version) => (
          <button
            key={version.id}
            onClick={() => onSelectVersion(version.id)}
            className={twMerge(
              'w-full text-left px-2 py-1 hover:bg-[var(--mint)]/50',
              selectedVersionId === version.id && 'bg-[var(--mint)]',
            )}
          >
            <span className="text-neutral-500 mr-2">{formatRelativeTime(version.createdAt)}</span>
            <span className={version.creator === Entity.SYSTEM ? 'text-orange-600' : 'text-neutral-700'}>
              {version.creator === Entity.SYSTEM ? 'ai' : 'you'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
