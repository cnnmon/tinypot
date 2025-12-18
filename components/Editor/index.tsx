'use client';

import Branchbar from './Branchbar';
import Composer from './Composer';

export default function Editor() {
  return (
    <div className="m-2 p-2 flex flex-col gap-2 flex-1 min-h-0">
      <Branchbar />
      <Composer />
    </div>
  );
}
