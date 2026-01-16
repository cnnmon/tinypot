'use client';

import { getBranchStatus, isResolved } from '@/lib/branch';
import { timeAgo } from '@/lib/player/utils/time';
import { useProject } from '@/lib/project';
import { Branch } from '@/types/branch';
import { twMerge } from 'tailwind-merge';

function Body({ branch }: { branch: Branch }) {
  const { approveBranch, rejectBranch, unresolvedBranches } = useProject();
  const resolved = isResolved(branch);
  const status = getBranchStatus(branch);

  if (resolved) {
    const isRejected = branch.approved === false;
    return (
      <div className="text-neutral-500">
        <span className={twMerge(status === 'Approved' ? 'text-emerald-600' : 'text-neutral-400')}>
          {status}
        </span>
        , viewing {isRejected ? 'generated content' : 'your edits'} in editor
      </div>
    );
  }

  // Only allow reverting the newest unresolved branch to prevent data loss
  const newestUnresolved =
    unresolvedBranches.length > 0
      ? unresolvedBranches.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      : null;
  const canRevert = newestUnresolved?.id === branch.id;

  return (
    <div className="space-y-2 relative h-full flex-1 flex flex-col">
      <p>
        <b>Changelog:</b> {branch.title}
      </p>
      <p className="text-neutral-500">
        You're viewing the changes made in this branch in <b>Editor</b>. If you're happy with them,{' '}
        <b>resolve</b> this branch to archive it.
      </p>
      <div className="absolute bottom-0 left-0 flex gap-2">
        <button className="bg-[#b7dcbd]!" onClick={() => approveBranch(branch.id)}>
          Approve
        </button>
        {canRevert && (
          <>
            <p>or</p>
            <button className="bg-[#F7C7DD]!" onClick={() => rejectBranch(branch.id, true)}>
              Discard branch
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Detail({ branch }: { branch: Branch }) {
  const { setSelectedBranchId } = useProject();

  return (
    <div className="space-y-2 flex h-full flex-1 flex-col">
      <div className="flex justify-between gap-2 items-center">
        <button
          onClick={() => setSelectedBranchId(null)}
          className="no-underline! flex items-center gap-1 bg-neutral-700/10!"
        >
          ←<h1>My branches</h1>
        </button>
        <div className="flex gap-2 items-center">
          <p className="text-neutral-400 text-sm">{timeAgo(branch.createdAt)} ago</p>
        </div>
      </div>
      <Body branch={branch} />
    </div>
  );
}
