'use client';

import Header from '@/components/Header';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { ProjectProvider, useProject } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function PlayContent() {
  const { project } = useProject();

  return (
    <div className="h-screen p-4 gap-4 flex flex-col">
      <div className="flex w-full items-center gap-2">
        <Header />
        <p className="text-lg">{project.name}</p>
      </div>

      <div className="w-full max-w-xl h-[calc(100%-160px)]">
        <Player />
      </div>
    </div>
  );
}

export default function PlayPage() {
  const params = useParams();
  const shareId = params.projectId as string;

  // Decode on client side (atob not available during SSR)
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const decoded = decodeShareId(shareId);
    setProjectId(decoded);
    setIsLoading(false);
  }, [shareId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-neutral-400">Invalid share link</p>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={projectId as Id<'projects'>}>
      <PlayerProvider>
        <PlayContent />
      </PlayerProvider>
    </ProjectProvider>
  );
}
