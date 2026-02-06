'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/lib/project';
import { Entity } from '@/types/entities';
import { useMutation } from 'convex/react';
import { twMerge } from 'tailwind-merge';
import ScrollContainer from '../ScrollContainer';
import { describeChanges } from './utils/describeChanges';
import { formatRelativeTime } from './utils/formatRelativeTime';
import { snapshotsEqual } from './utils/snapshotsEqual';

export { coalesceVersions } from './utils/coalesceVersions';

export default function Versions() {
  const { project, versions, selectedVersionId, setSelectedVersionId } = useProject();
  const deleteVersionMutation = useMutation(api.versions.remove);
  const currentSnapshot = { script: project.script, guidebook: project.guidebook };

  const deleteVersion = (versionId: string) => {
    if (selectedVersionId === versionId) {
      setSelectedVersionId(null);
    }
    deleteVersionMutation({ versionId: versionId as Id<'versions'> });
  };

  // Build version items with change descriptions
  // Include current state as the first item if it differs from latest version
  const hasUnsavedChanges = versions.length === 0 || !snapshotsEqual(currentSnapshot, versions[0].snapshot);

  return (
    <div className="flex flex-col h-full">
      {/* Header with save status */}
      <div className="flex items-center p-2 border-b-2 justify-between">
        <h1 className="cursor-default">versions</h1>
      </div>

      {/* Version list */}
      <ScrollContainer direction="vertical" className="space-y-1 p-2">
        {/* Saved versions with change descriptions */}
        {versions.map((version, idx) => {
          const previousVersion = versions[idx + 1] ?? null;
          const changeDesc = describeChanges(version.snapshot, previousVersion?.snapshot ?? null);
          const isAI = version.creator === Entity.SYSTEM;
          const isSelected = selectedVersionId === version.id;

          return (
            <div
              key={version.id}
              className={twMerge(
                'w-full flex hover:bg-[var(--mint)]/30 justify-between group',
                isSelected ? 'bg-[var(--mint)]/50' : '',
              )}
            >
              <button
                onClick={() => setSelectedVersionId(isSelected ? null : version.id)}
                className="flex-1 text-left"
              >
                <span className={isAI ? 'text-orange-600' : ''}>{isAI ? 'ai' : 'you'}</span>
                <span className="ml-1 opacity-50">({changeDesc})</span>
              </button>
              <div className="flex items-center gap-1">
                <span className="opacity-50">{formatRelativeTime(version.createdAt)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteVersion(version.id);
                  }}
                  className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-red-500 px-1"
                  title="Delete version"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}

        {versions.length === 0 && !hasUnsavedChanges && (
          <p className="text-neutral-400 px-2">no versions yet</p>
        )}
      </ScrollContainer>
    </div>
  );
}
