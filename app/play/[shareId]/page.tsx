'use client';

import BranchDesign from '@/components/Editor/Branchbar/BranchDesign';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { ProjectProvider } from '@/lib/project';
import { decodeShareId } from '@/lib/share';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  const [randomNumber, setRandomNumber] = useState(0);

  useEffect(() => {
    setRandomNumber(Math.floor(Math.random() * 1000000));
  }, []);

  return (
    <div className="h-screen p-4 gap-2 flex flex-col text-center">
      <div className="flex items-center justify-between">
        <p className="cursor-pointer" onClick={() => (window.location.href = '/')}>
          tinypot
        </p>
        <div className="relative flex justify-center items-center mb-1">
          <BranchDesign seed={randomNumber} width={25} height={25} />
          <Image
            alt="plantpot"
            src="/icons/PlantPot.svg"
            width={15}
            height={15}
            className="absolute top-[12px]"
          />
        </div>{' '}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto w-full h-full text-left">
          <Player showTitle={false} />
        </div>
      </div>
    </div>
  );
}
