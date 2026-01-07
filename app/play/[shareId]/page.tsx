'use client';

import Header from '@/components/Header';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider, usePlayerContext } from '@/lib/player/PlayerProvider';
import { ProjectProvider } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
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
      <PlayerProvider>
        <PlayContent />
      </PlayerProvider>
    </ProjectProvider>
  );
}

function PlayContent() {
  const { handleJumpBack, handleRestart } = usePlayerContext();

  return (
    <div className="h-full p-4 gap-2 flex flex-col text-center">
      <div className="fixed flex p-2 px-4 bg-white top-0 left-0 w-full items-center justify-between z-[1]">
        <Header showProjects={false} />
        <div className="flex gap-1">
          <button onClick={handleJumpBack} className="p-1 rounded">
            <ArrowLeftIcon width={14} height={14} />{' '}
          </button>
          <button onClick={handleRestart} className="p-1 rounded">
            <ArrowPathIcon width={14} height={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto w-full text-left">
          <Player />
        </div>
      </div>
    </div>
  );
}
