import { getBranchStatus, isResolved } from '@/lib/branch';
import { timeAgo } from '@/lib/player/utils/time';
import { Branch } from '@/types/branch';
import { twMerge } from 'tailwind-merge';

export default function Item({
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
      className={twMerge(
        'group w-full text-left transition-all bg-transparent! no-underline! hover:bg-neutral-700/20!',
        resolved && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2 select-none">
        <span className={twMerge('text-neutral-700 truncate flex-1', resolved && 'line-through!')}>
          {branch.title}
        </span>
        <span className="text-neutral-400">
          {resolved ? status.toLowerCase() : timeAgo(branch.createdAt)}
        </span>
        <span className="bg-transparent! no-underline!">→</span>
      </div>
    </button>
  );
}
