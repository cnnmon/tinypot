'use client';

import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { ProjectProvider } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import { useParams } from 'next/navigation';

export default function PlayPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const projectId = decodeShareId(shareId);

  if (!projectId) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-400">Invalid or expired link</p>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={projectId as Id<'projects'>}>
      <PlayContent />
    </ProjectProvider>
  );
}

function PlayContent() {
  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      <header className="p-4 border-b border-neutral-200 bg-white">
        <h1 className="text-lg font-medium">Play</h1>
      </header>
      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-2xl mx-auto h-full">
          <Player />
        </div>
      </main>
    </div>
  );
}

