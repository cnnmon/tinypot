import { useProject } from '@/lib/project';
import { twMerge } from 'tailwind-merge';

export default function Branchbar() {
  const { game, viewingBranch, setViewingBranch } = useProject();

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      <button
        onClick={() => setViewingBranch(null)}
        className={twMerge('px-3 py-1 rounded bordered bg-mint')}
      >
        Main branch
      </button>

      {game.branches.map((branch, i) => (
        <button
          key={branch.id}
          onClick={() => setViewingBranch(branch)}
          className={`px-3 py-1 rounded ${
            viewingBranch?.id === branch.id
              ? 'bg-black text-white'
              : 'bg-neutral-200 hover:bg-neutral-300'
          }`}
        >
          branch {i + 1}
        </button>
      ))}
    </div>
  );
}
