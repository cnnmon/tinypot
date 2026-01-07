'use client';

import { useProject } from '@/lib/project';
import Detail from './Detail';
import List from './List';

export default function Branchbar() {
  const { branches, selectedBranchId } = useProject();
  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null;

  if (selectedBranch) {
    return <Detail branch={selectedBranch} />;
  }

  if (branches.length === 0) {
    return (
      <>
        <h1>Branches</h1>
        <p className="text-neutral-800/40">Play to generate branches.</p>
      </>
    );
  }

  return <List />;
}
