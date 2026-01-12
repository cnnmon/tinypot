'use client';

import Header from '@/components/Header';
import ProjectsSelector from '@/components/Header/ProjectsSelector';

export default function Home() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <div className="flex gap-2 items-center">
        <Header />
        <ProjectsSelector />
      </div>
    </div>
  );
}
