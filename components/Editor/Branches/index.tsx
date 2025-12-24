import { useMemo } from 'react';
import BranchDesign from './BranchDesign';

export default function Branchbar() {
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className="w-full bordered rounded-lg flex items-center justify-between px-3 py-2"
        style={{
          background: 'linear-gradient(180deg, var(--color-mint) 0%, var(--color-lime) 100%)',
        }}
      >
        <div className="flex items-center justify-center">
          <BranchDesign seed={randomSeed} />
        </div>
      </div>

      {[].map((_branch, i) => (
        <div key={i}>branch {i + 1}</div>
      ))}
    </div>
  );
}
