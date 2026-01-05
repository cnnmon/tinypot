'use client';

import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-neutral-400">
          Select a project or create a new one from the dropdown above
        </p>
      </div>
    </div>
  );
}
