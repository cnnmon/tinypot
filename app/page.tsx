'use client';

import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <Header showProjects={true} />
    </div>
  );
}
