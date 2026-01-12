'use client';

import { useTooltipTrigger } from '@/components/TooltipProvider';
import { useProject } from '@/lib/project';
import Detail from './Detail';
import List from './List';

export default function Branchbar() {
  const { branches, selectedBranchId } = useProject();
  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null;
  const tooltipProps = useTooltipTrigger('Create new paths from playthroughs');

  if (selectedBranch) {
    return <Detail branch={selectedBranch} />;
  }

  if (branches.length === 0) {
    return (
      <>
        <h1 {...tooltipProps}>My branches</h1>
        <p className="text-neutral-800/40">Play to generate branches.</p>
      </>
    );
  }

  return <List />;
}
