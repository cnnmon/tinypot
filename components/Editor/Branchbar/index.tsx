import { IconButton } from '@/components/Button';
import { useProject } from '@/lib/project';
import { XMarkIcon } from '@heroicons/react/16/solid';
import Branch from './Branch';

export default function Branchbar() {
  const { game, setViewingBranch } = useProject();

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      <div
        onClick={() => setViewingBranch(null)}
        className="bg-mint w-full bordered rounded-lg flex items-center justify-between px-3"
      >
        <div className="flex items-center justify-center">
          <Branch width={100} height={100} seed={2} />
        </div>
        <IconButton onClick={() => setViewingBranch(null)}>
          <XMarkIcon className="w-4 h-4" />
        </IconButton>
      </div>

      {game.branches.map((branch, i) => (
        <div key={branch.id} onClick={() => setViewingBranch(branch)}>
          branch {i + 1}
        </div>
      ))}
    </div>
  );
}
