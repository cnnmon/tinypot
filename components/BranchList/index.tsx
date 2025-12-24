'use client';

import { Branch, BranchStatus } from '@/types/branch';
import ArrowRight from '@icons/ArrowRight.svg';

export default function BranchList() {
  const branches: Branch[] = [];

  if (branches.length === 0) {
    return <p className="text-gray-500 italic">No branches yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {branches.map((branch, index) => (
        <BranchItem
          key={branch.id}
          branch={branch}
          index={index}
          isActive={false}
          onSelect={() => {}}
        />
      ))}
    </div>
  );
}

interface BranchItemProps {
  branch: Branch;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}

function BranchItem({ branch, index, isActive, onSelect }: BranchItemProps) {
  const statusLabel =
    branch.status === BranchStatus.APPROVED
      ? '✓'
      : branch.status === BranchStatus.REJECTED
        ? '✗'
        : '';

  // Get a preview of what changed (first narrative or option in resolved schema)
  const preview = getBranchPreview(branch);

  return (
    <button
      onClick={onSelect}
      className={`flex items-center justify-between w-full px-2 py-1 text-left transition-colors
        ${isActive ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-gray-400 shrink-0">#{index + 1}</span>
        <span className="truncate">{preview}</span>
        {statusLabel && (
          <span
            className={`text-xs ${
              branch.status === BranchStatus.APPROVED ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <ArrowRight className="stroke-current w-6 h-6 shrink-0" />
    </button>
  );
}

/**
 * Extracts a human-readable preview of what a branch contains.
 */
function getBranchPreview(branch: Branch): string {
  // Use edited version if available, otherwise generated
  const resolved = branch.edited ?? branch.generated;
  const base = branch.base;

  // Find the first new element in resolved that's not in base
  for (const line of resolved) {
    const isNew = !base.some((baseLine) => JSON.stringify(baseLine) === JSON.stringify(line));

    if (isNew) {
      if ('text' in line) {
        return line.text.slice(0, 40) + (line.text.length > 40 ? '...' : '');
      }
      if ('label' in line) {
        return `Scene: ${line.label}`;
      }
      if ('target' in line) {
        return `→ ${line.target}`;
      }
    }
  }

  return 'Branch changes';
}
