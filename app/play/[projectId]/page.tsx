'use client';

import Header from '@/components/Header';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { ProjectProvider, useProject } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import { EyeIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function PlayContent({ shareId }: { shareId: string }) {
  const { project } = useProject();

  return (
    <div className="h-screen p-4 gap-4 flex flex-col items-center">
      <div className="flex w-full items-center justify-between">
          <Header />
          <div className="flex items-center gap-2">
            <p className="text-lg">{project.name}</p>
            <button title="View project in editor" onClick={() => window.open(`/edit/${project.id}`, '_blank')} className="px-1"><EyeIcon className="w-4 h-4" /></button>
          </div>
      </div>

      <div className="w-full md:max-w-2xl h-[calc(100%-160px)]">
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
        <PlayContent shareId={shareId} />
      </PlayerProvider>
    </ProjectProvider>
  );
}
