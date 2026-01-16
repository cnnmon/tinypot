'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import { useTooltipTrigger } from '@/components/TooltipProvider';
import { getBranchStatus, isResolved } from '@/lib/branch';
import { timeAgo } from '@/lib/player/utils/time';
import { useProject } from '@/lib/project';
import { Branch } from '@/types/branch';
import { BookOpenIcon, CheckIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

type Selection = 'guidebook' | 'current' | string; // string = branch ID

function BranchItem({
  branch,
  isSelected,
  onClick,
}: {
  branch: Branch;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = getBranchStatus(branch);
  const resolved = isResolved(branch);

  return (
    <button
      onClick={onClick}
      className={twMerge(
        'text-left p-2 text-sm w-full',
        resolved
          ? isSelected
            ? 'bg-neutral-200'
            : 'opacity-50 hover:bg-neutral-100'
          : isSelected
            ? 'bg-[var(--mint)]/60'
            : 'bg-[var(--mint)]/30 hover:bg-[var(--mint)]/40',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{branch.title}</span>
        <span
          className={twMerge(
            'text-xs',
            resolved
              ? status === 'Approved'
                ? 'text-green-600'
                : 'text-neutral-400'
              : 'text-amber-600',
          )}
        >
          {resolved ? status : 'Pending'}
        </span>
      </div>
      <div className="text-xs text-neutral-400">{timeAgo(branch.createdAt)} ago</div>
    </button>
  );
}

export default function BranchesModal({ onClose }: { onClose: () => void }) {
  const { branches, unresolvedBranches, approveBranch, rejectBranch, project, setProject } =
    useProject();
  const diffRef = useRef<HTMLDivElement>(null);

  // Use local state for modal selection (doesn't affect project)
  const [selection, setSelection] = useState<Selection>('current');

  const selectedBranch =
    selection !== 'guidebook' && selection !== 'current'
      ? (branches.find((b) => b.id === selection) ?? null)
      : null;

  const handleSelect = (sel: Selection) => {
    setSelection(sel);
    // Scroll to diff area
    diffRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const revertTooltip = useTooltipTrigger(
    'You can only discard the newest unresolved branch to prevent data loss',
  );

  // Sort branches: unresolved first (newest), then resolved (newest)
  const sortedBranches = useMemo(() => {
    const unresolved = [...unresolvedBranches].sort((a, b) => b.createdAt - a.createdAt);
    const resolved = branches
      .filter((b) => isResolved(b))
      .sort((a, b) => b.createdAt - a.createdAt);
    return [...unresolved, ...resolved];
  }, [branches, unresolvedBranches]);

  const canRevert = useMemo(() => {
    if (!selectedBranch || isResolved(selectedBranch)) return false;
    const newestUnresolved =
      unresolvedBranches.length > 0
        ? unresolvedBranches.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
        : null;
    return newestUnresolved?.id === selectedBranch.id;
  }, [selectedBranch, unresolvedBranches]);

  const [localGuidebook, setLocalGuidebook] = useState(project.guidebook);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10] p-3">
      <Box
        header={
          <>
            <b>edit ({unresolvedBranches.length})</b>
            <button onClick={onClose}>
              <XMarkIcon className="w-4 h-4" />
            </button>
          </>
        }
        className="w-full max-w-4xl h-[80vh] bg-white"
      >
        <div className="flex flex-1 h-full">
          {/* Branch list */}
          <div className="w-48 flex-shrink-0 overflow-y-scroll border-r-2">
            <div className="space-y-1">
              {/* Special entries */}
              <div className="p-2">
                <button
                  onClick={() => handleSelect('guidebook')}
                  className={twMerge(
                    'text-left px-2 py-1 text-sm w-full flex items-center gap-2',
                    selection === 'guidebook' ? 'bg-blue-100' : 'hover:bg-neutral-100',
                  )}
                >
                  <BookOpenIcon className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <div className="font-medium">guidebook</div>
                    <div className="text-xs text-neutral-400">Learned from edits</div>
                  </div>
                </button>

                <button
                  onClick={() => handleSelect('current')}
                  className={twMerge(
                    'text-left px-2 py-1 text-sm w-full flex items-center gap-2',
                    selection === 'current' ? 'bg-blue-100' : 'hover:bg-neutral-100',
                  )}
                >
                  <DocumentTextIcon className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <h2>script</h2>
                    <p className="text-xs text-neutral-400">Edit your script in text</p>
                  </div>
                </button>
              </div>

              <div className="p-2 border-t-2 flex flex-col gap-2">
                {/* Divider */}
                {sortedBranches.length > 0 && (
                  <div>
                    <div className="text-xs text-neutral-400">branches</div>
                  </div>
                )}

                <div>
                  {/* Branch entries */}
                  {sortedBranches.map((branch) => (
                    <BranchItem
                      key={branch.id}
                      branch={branch}
                      isSelected={selection === branch.id}
                      onClick={() => handleSelect(branch.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content view */}
          <div ref={diffRef} className="flex-1 flex flex-col min-w-0">
            {selection === 'guidebook' ? (
              <>
                <div className="p-2 border-b-2">
                  <p className="font-medium">guidebook</p>
                  <p className="text-xs text-neutral-400">
                    What we&apos;ve learned from your edits. Used as a prompt for when the AI
                    generates new branches.
                  </p>
                </div>
                <div className="p-2 h-[calc(100%-49px)]">
                  <textarea
                    className="flex-1 w-full h-full p-3 text-sm font-mono border-2 rounded resize-none focus:outline-none focus:border-blue-300"
                    value={localGuidebook}
                    onChange={(e) => setLocalGuidebook(e.target.value)}
                    onBlur={() => setProject({ guidebook: localGuidebook })}
                    placeholder="No guidelines yet. Play through your game and make edits - we'll learn from them!"
                  />
                </div>
              </>
            ) : selection === 'current' ? (
              <>
                <div className="p-2 border-b-2">
                  <p className="font-medium">current script</p>
                  <p className="text-xs text-neutral-400">
                    Your project as it currently exists. You can edit it here.
                  </p>
                </div>
                <div className="h-[calc(100%-49px)]">
                  <Editor key="current-editor" />
                </div>
              </>
            ) : selectedBranch ? (
              <>
                <div className="flex items-center justify-between border-b-2 p-2">
                  <div>
                    <p className="font-medium">{selectedBranch.title}</p>
                    <p className="text-xs text-neutral-400">
                      Includes: {selectedBranch.sceneIds.join(', ')}
                    </p>
                  </div>
                  {!isResolved(selectedBranch) && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => approveBranch(selectedBranch.id)}
                        className="flex items-center gap-1 text-sm px-2 py-1 bg-[var(--mint)] hover:bg-[var(--mint)]/80"
                      >
                        <CheckIcon className="w-3 h-3" /> Accept
                      </button>
                      <button
                        onClick={() => rejectBranch(selectedBranch.id, true)}
                        className={twMerge(
                          'flex items-center gap-1 text-sm px-2 py-1 bg-red-100',
                          canRevert ? 'hover:bg-red-200' : 'opacity-50 cursor-not-allowed',
                        )}
                        disabled={!canRevert}
                        {...(!canRevert ? revertTooltip : {})}
                      >
                        <XMarkIcon className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
                <Editor
                  key={`branch-${selectedBranch.id}`}
                  readOnly={isResolved(selectedBranch)}
                  branch={selectedBranch}
                />
              </>
            ) : (
              <p className="text-neutral-400">Select an item to view</p>
            )}
          </div>
        </div>
      </Box>
    </div>
  );
}
