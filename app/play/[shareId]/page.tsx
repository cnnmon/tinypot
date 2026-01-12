'use client';

import Header from '@/components/Header';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { ProjectProvider } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import { useParams } from 'next/navigation';

export default function PlayPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const projectId = decodeShareId(shareId);

  if (!projectId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f0f7f0] to-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl text-neutral-600 font-light">Story not found</h1>
          <p className="text-neutral-400">This link may have expired or is invalid.</p>
        </div>
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
  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-[#f0f7f0] to-white">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Header />
      </div>

      {/* Story area */}
      <div className="flex-1 overflow-hidden flex justify-center">
        <div className="w-full max-w-2xl m-4 relative">
          <Player />
        </div>
      </div>
    </div>
  );
}
