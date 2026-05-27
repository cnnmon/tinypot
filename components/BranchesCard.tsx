'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/lib/project';
import { Version } from '@/types/version';
import { ArrowRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useMutation } from 'convex/react';
import { useMemo } from 'react';
import { twMerge } from 'tailwind-merge';
import ScrollContainer from './ScrollContainer';
import { coalesceVersions } from './Versions';
import { describeChanges } from './Versions/utils/describeChanges';
import { snapshotsEqual } from './Versions/utils/snapshotsEqual';

interface CoalescedGroup {
  version: Version;
  count: number; // number of raw versions folded into this group
}

/** Coalesce + count how many raw versions each surviving entry represents. */
function withCounts(versions: Version[]): CoalescedGroup[] {
  const coalesced = coalesceVersions(versions);
  const groups: CoalescedGroup[] = [];
  let cursor = 0;
  for (let g = 0; g < coalesced.length; g++) {
    const v = coalesced[g];
    const startIdx = versions.findIndex((raw, i) => i >= cursor && raw.id === v.id);
    const next = coalesced[g + 1];
    const endIdx = next ? versions.findIndex((raw) => raw.id === next.id) : versions.length;
    groups.push({ version: v, count: Math.max(1, endIdx - startIdx) });
    cursor = endIdx;
  }
  return groups;
}

export default function BranchesCard() {
  const { project, versions, selectedVersionId, setSelectedVersionId } = useProject();
  const deleteVersionMutation = useMutation(api.versions.remove);
  const groups = useMemo(() => withCounts(versions), [versions]);
  const hasUnsaved =
    versions.length === 0 ||
    !snapshotsEqual({ script: project.script, guidebook: project.guidebook }, versions[0].snapshot);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(versions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-history.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col bordered min-h-0 flex-1 bg-gradient-to-b from-[var(--sunflower)] to-white">
      <div className="flex items-center justify-between p-2 border-b-2">
        <h2>Branches</h2>
        <button onClick={handleDownload} title="Download history as JSON">
          <ArrowDownTrayIcon className="w-4 h-4 opacity-50 hover:opacity-100" />
        </button>
      </div>

      <ScrollContainer direction="vertical" className="flex-1 p-1">
        {groups.length === 0 && !hasUnsaved && <p className="text-neutral-400 px-2 py-1">no branches yet</p>}

        {groups.map(({ version, count }, idx) => {
          const prev = groups[idx + 1]?.version.snapshot ?? null;
          const title = describeChanges(version.snapshot, prev);
          const isSelected = selectedVersionId === version.id;
          const isAi = version.creator === 'system';

          return (
            <div
              key={version.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedVersionId(isSelected ? null : version.id)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                setSelectedVersionId(isSelected ? null : version.id);
              }}
              className={twMerge(
                'group w-full flex items-center justify-between gap-1 px-2 py-1 hover:bg-black hover:text-white text-left cursor-pointer',
                isSelected ? 'bg-[var(--mint)]! text-black!' : selectedVersionId ? 'opacity-30' : undefined,
              )}
            >
              <span className="truncate flex-1 min-w-0">
                <span className={isAi ? 'text-orange-600' : ''}>{title}</span>
                <span className="opacity-50"> ({count})</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) setSelectedVersionId(null);
                    deleteVersionMutation({ versionId: version.id as Id<'versions'> });
                  }}
                  className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-red-500 px-1"
                  title="Delete"
                >
                  ×
                </button>
                <ArrowRightIcon className="w-4 h-4 opacity-40 group-hover:opacity-100" />
              </div>
            </div>
          );
        })}
      </ScrollContainer>
    </div>
  );
}
