import { isResolved } from '@/lib/branch';
import { useProject } from '@/lib/project';
import Item from './Item';

export default function List() {
  const { branches, unresolvedBranches, setSelectedBranchId } = useProject();

  // Sort unresolved branches newest first - must discard in this order
  const sortedUnresolvedBranches = [...unresolvedBranches].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  const resolvedBranches = branches
    .filter((b) => isResolved(b))
    .sort((a, b) => b.createdAt - a.createdAt); // Recent first

  return (
    <div className="space-y-2 pb-2">
      <div className="flex items-center gap-1 justify-between">
        <h1>My branches</h1>
        {unresolvedBranches.length > 0 && (
          <div className="flex items-center gap-1 text-sm">
            {unresolvedBranches.length} pending branches
            <span className="text-neutral-400">•</span>
            <span className="text-neutral-400">{resolvedBranches.length} resolved</span>
          </div>
        )}
      </div>

      {sortedUnresolvedBranches.map((branch) => (
        <Item key={branch.id} branch={branch} onClick={() => setSelectedBranchId(branch.id)} />
      ))}

      {resolvedBranches.map((branch) => (
        <Item key={branch.id} branch={branch} onClick={() => setSelectedBranchId(branch.id)} />
      ))}
    </div>
  );
}
