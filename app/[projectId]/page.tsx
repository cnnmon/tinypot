'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Branchbar from '@/components/Editor/Branchbar';
import GuidebookModal from '@/components/GuidebookModal';
import Header from '@/components/Header';
import Player from '@/components/Player';
import ShareButton from '@/components/ShareButton';
import { Id } from '@/convex/_generated/dataModel';
import { ProjectProvider, useProject } from '@/lib/project';
import { useParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ProjectContent() {
  const { project, setProject, guidebook, setGuidebook, isGuidebookUpdating } = useProject();
  const [leftWidth, setLeftWidth] = useState(50);
  const [guidebookOpen, setGuidebookOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(Math.max(newWidth, 20), 80));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <div className="flex items-center justify-between">
        <Header showProjects={true} />
        <ShareButton />
      </div>

      <GuidebookModal
        isOpen={guidebookOpen}
        onClose={() => setGuidebookOpen(false)}
        guidebook={guidebook}
        onSave={setGuidebook}
        isUpdating={isGuidebookUpdating}
      />

      <div className="flex gap-2">
        <Box
          className={twMerge(
            'bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white min-h-45 w-5 cursor-pointer hover:opacity-90',
            isGuidebookUpdating &&
              'bg-gradient-to-b via-[var(--orange)] from-[var(--rose)] to-white',
          )}
          onClick={() => setGuidebookOpen(true)}
        >
          {isGuidebookUpdating && (
            <span className="text-neutral-800/40 animate-pulse">(Updating guidebook...)</span>
          )}
          <p className="line-clamp-4">{guidebook || 'Author is making a game about...'}</p>
        </Box>

        <Box className="max-h-45 overflow-auto select-none bg-gradient-to-b from-[var(--sunflower)] to-white">
          <Branchbar />
        </Box>
      </div>

      <div
        ref={containerRef}
        className="flex flex-row min-h-[calc(100%-210px)] h-[calc(100%-210px)] pb-5"
      >
        <Box style={{ width: `${leftWidth}%` }}>
          <b>Editor</b>
          <Editor />
        </Box>
        <div
          onMouseDown={handleMouseDown}
          className="w-2 cursor-col-resize hover:bg-gray-300 transition-colors shrink-0"
        />
        <Box style={{ width: `${100 - leftWidth}%` }}>
          <Player />
        </Box>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Validate that projectId looks like a Convex ID (not legacy "123")
  const isValidId = projectId && projectId.length > 10;

  if (!isValidId) {
    return (
      <div className="h-screen p-4 gap-2 flex flex-col">
        <Header showProjects={true} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">
            Invalid project ID. Please select a project from the dropdown.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={projectId as Id<'projects'>}>
      <ProjectContent />
    </ProjectProvider>
  );
}
