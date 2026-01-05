import { isResolved } from '@/lib/branch';
import { useProject } from '@/lib/project';
import Item from './Item';

export default function List() {
  const { branches, unresolvedBranches, selectedBranchId, setSelectedBranchId } = useProject();
  const resolvedBranches = branches.filter((b) => isResolved(b));

  return (
    <div className="space-y-2">
      {unresolvedBranches.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          {unresolvedBranches.length} pending branches
          <span className="text-neutral-400">•</span>
          <span className="text-neutral-400">{resolvedBranches.length} resolved</span>
        </div>
      )}

      {unresolvedBranches.map((branch) => (
        <Item
          key={branch.id}
          branch={branch}
          isSelected={selectedBranchId === branch.id}
          onClick={() => setSelectedBranchId(branch.id)}
        />
      ))}

      {resolvedBranches.map((branch) => (
        <Item
          key={branch.id}
          branch={branch}
          isSelected={selectedBranchId === branch.id}
          onClick={() => setSelectedBranchId(branch.id)}
        />
      ))}
    </div>
  );
}
