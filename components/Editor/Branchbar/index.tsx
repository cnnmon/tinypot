import { useProject } from '@/lib/project';
import { useMemo } from 'react';
import Branch from './Branch';

export default function Branchbar() {
  const { game, setViewingBranch } = useProject();
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      <div
        onClick={() => setViewingBranch(null)}
        className="bg-mint w-full bordered rounded-lg flex items-center justify-between px-3 py-2"
      >
        <div className="flex items-center justify-center">
          <Branch seed={randomSeed} />
        </div>
      </div>

      {game.branches.map((branch, i) => (
        <div key={branch.id} onClick={() => setViewingBranch(branch)}>
          branch {i + 1}
        </div>
      ))}
    </div>
  );
}
