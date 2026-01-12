'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Branchbar from '@/components/Editor/Branchbar';
import Header from '@/components/Header';
import Player from '@/components/Player';
import ShareButton from '@/components/ShareButton';
import { useTooltipTrigger } from '@/components/TooltipProvider';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider, usePlayerContext } from '@/lib/player/PlayerProvider';
import { ProjectProvider, useProject } from '@/lib/project';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ProjectContent() {
  const { project, setProject, recordGuidebookChanges, isMetalearning } = useProject();
  const { handleJumpBack, handleRestart } = usePlayerContext();
  const [leftWidth, setLeftWidth] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const guidebookTooltip = useTooltipTrigger('The guidebook learns from your branch edits');
  const jumpBackTooltip = useTooltipTrigger('Undo last choice');
  const restartTooltip = useTooltipTrigger('Restart');

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

  const guidebook = project.guidebook;
  const [guidebookBaseline, setGuidebookBaseline] = useState(guidebook);

  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <div className="flex items-center justify-between">
        <Header showProjects={true} />
        <ShareButton />
      </div>

      <div className="flex gap-2">
        <Box
          className={twMerge(
            'bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white min-h-45 w-5 hover:opacity-90',
            isMetalearning && 'bg-gradient-to-b via-[var(--orange)] from-[var(--rose)] to-white',
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <h1 className="cursor-default" {...guidebookTooltip}>
              Guidebook
            </h1>
          </div>
          {isMetalearning && (
            <span className="text-neutral-800/40 animate-pulse">(Updating guidebook...)</span>
          )}
          <textarea
            value={guidebook}
            placeholder="Author is making a game about..."
            className="w-full h-full"
            onFocus={() => setGuidebookBaseline(guidebook)}
            onChange={(e) => setProject({ guidebook: e.target.value })}
            onBlur={() => recordGuidebookChanges(guidebookBaseline, guidebook)}
          />
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
          <Player
            header={
              <div>
                <div className="flex items-center justify-between">
                  <h1>Player</h1>
                  <div className="w-full justify-end flex gap-1 text-neutral-400">
                    <button onClick={handleJumpBack} className="p-1 rounded" {...jumpBackTooltip}>
                      <ArrowLeftIcon width={14} height={14} />
                    </button>
                    <button onClick={handleRestart} className="p-1 rounded" {...restartTooltip}>
                      <ArrowPathIcon width={14} height={14} />
                    </button>
                  </div>
                </div>
              </div>
            }
          />
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
      <PlayerProvider>
        <ProjectContent />
      </PlayerProvider>
    </ProjectProvider>
  );
}
