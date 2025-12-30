'use client';

import { getBranchStatus, isResolved } from '@/lib/branch';
import { useProject } from '@/lib/project';
import { Branch } from '@/types/branch';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BranchItem({
  branch,
  isSelected,
  onClick,
}: {
  branch: Branch;
  isSelected: boolean;
  onClick: () => void;
}) {
  const resolved = isResolved(branch);
  const status = getBranchStatus(branch);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded border transition-colors ${
        isSelected
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      } ${resolved ? 'opacity-50' : ''}`}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="font-medium text-sm truncate">{branch.title}</span>
        <span className="text-xs text-gray-500 shrink-0">
          {resolved ? status : timeAgo(branch.createdAt)}
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {branch.sceneIds.length} scene{branch.sceneIds.length !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

function BranchDetail({ branch }: { branch: Branch }) {
  const { approveBranch, rejectBranch, setSelectedBranchId } = useProject();
  const resolved = isResolved(branch);
  const status = getBranchStatus(branch);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">{branch.title}</h3>
        <p className="text-xs text-gray-500">
          Generated {timeAgo(branch.createdAt)} · {branch.sceneIds.length} scene
          {branch.sceneIds.length !== 1 ? 's' : ''} changed
        </p>
      </div>

      {resolved ? (
        <>
          <div className="text-sm">
            <span className="text-gray-500">Status: </span>
            <span
              className={
                status === 'Approved'
                  ? 'text-green-600'
                  : status === 'Rejected'
                    ? 'text-red-600'
                    : 'text-yellow-600'
              }
            >
              {status}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            View the diff in the editor. Gray = pre-existing, Yellow = AI-generated, Green = your
            edits.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-600">
            Edit to your heart&apos;s content then close with Accept. Or delete entirely with
            Reject.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => approveBranch(branch.id)}
              className="flex-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => rejectBranch(branch.id, true)}
              className="flex-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Reject
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setSelectedBranchId(null)}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        ← View all branches
      </button>
    </div>
  );
}

export default function Branchbar() {
  const { branches, unresolvedBranches, selectedBranchId, setSelectedBranchId } = useProject();

  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null;

  const resolvedBranches = branches.filter((b) => isResolved(b));

  // Mode 2: Branch selected - show detail with Accept/Reject
  if (selectedBranch) {
    return <BranchDetail branch={selectedBranch} />;
  }

  // Mode 1: Overview - show branch list
  if (branches.length === 0) {
    return <p className="text-gray-500">No branches yet. Play to generate new paths!</p>;
  }

  return (
    <div className="space-y-2">
      {/* Badge for unresolved count */}
      {unresolvedBranches.length > 0 && (
        <span className="inline-block px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full mb-2">
          {unresolvedBranches.length} unresolved
        </span>
      )}

      {/* Unresolved branches first */}
      {unresolvedBranches.map((branch) => (
        <BranchItem
          key={branch.id}
          branch={branch}
          isSelected={selectedBranchId === branch.id}
          onClick={() => setSelectedBranchId(branch.id)}
        />
      ))}

      {/* Resolved branches (faded) */}
      {resolvedBranches.length > 0 && unresolvedBranches.length > 0 && <hr className="my-2" />}
      {resolvedBranches.map((branch) => (
        <BranchItem
          key={branch.id}
          branch={branch}
          isSelected={selectedBranchId === branch.id}
          onClick={() => setSelectedBranchId(branch.id)}
        />
      ))}
    </div>
  );
}
