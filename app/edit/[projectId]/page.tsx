'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Header from '@/components/Header';
import Player from '@/components/Player';
import VersionHistory from '@/components/VersionHistory';
import VersionViewer from '@/components/VersionViewer';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { ProjectProvider, useProject } from '@/lib/project';
import { useProjects } from '@/lib/project/ProjectsProvider';
import { decodeShareId, getShareUrl } from '@/lib/share';
import { PencilIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ProjectContent({ isSharedView = false }: { isSharedView?: boolean }) {
  const { project, updateProject, versions, saveStatus, selectedVersionId, setSelectedVersionId, getDiffScripts, deleteVersion } =
    useProject();
  const { renameProject } = useProjects();
  const [leftWidth, setLeftWidth] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const diffScripts = getDiffScripts();

  const handleShare = useCallback(() => {
    const shareUrl = getShareUrl(project.id);
    window.open(shareUrl, '_blank');
  }, [project.id]);

  /* Tooltips */
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
  const isMetalearning = false;

  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <Header />
          <p className="text-lg">{project.name} {isSharedView && <span className="text-neutral-400 text-sm">(view-only)</span>}</p>
          {!isSharedView && (
            <button
              onClick={() => {
                const newName = prompt('Enter new name', project.name);
                if (newName) renameProject(project.id, newName);
              }}
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => window.open('/help', '_blank')} className="px-1">
            help
          </button>
          {!isSharedView && (
            <button onClick={handleShare} className="px-1">
              share
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Box
          className={twMerge(
            'bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white min-h-45 w-5 hover:opacity-90',
            isMetalearning && 'bg-gradient-to-b via-[var(--orange)] from-[var(--rose)] to-white',
          )}
        >
          <div className="p-3 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <h1 className="cursor-default">guidebook</h1>
            </div>
            {isMetalearning && <span className="text-neutral-800/40 animate-pulse">(Updating guidebook...)</span>}
            <textarea
              value={guidebook}
              placeholder="Always generate content based on this prompt..."
              className="w-full h-full"
              onChange={(e) => updateProject({ guidebook: e.target.value })}
              readOnly={isSharedView}
            />
          </div>
        </Box>

        <Box className="max-h-45 min-w-40 overflow-auto select-none bg-gradient-to-b from-[var(--sunflower)] to-white">
          <div className="p-3 h-full">
            <VersionHistory
              versions={versions}
              currentSnapshot={{ script: project.script, guidebook: project.guidebook }}
              saveStatus={saveStatus}
              selectedVersionId={selectedVersionId}
              onSelectVersion={setSelectedVersionId}
              onDeleteVersion={deleteVersion}
            />
          </div>
        </Box>
      </div>

      <div ref={containerRef} className="flex flex-row min-h-[calc(100%-210px)] h-[calc(100%-210px)] pb-5">
        <Box style={{ width: `${leftWidth}%` }}>
          <div className="flex h-10 items-center justify-between gap-1 border-b-2 p-2">
            <b>{diffScripts ? `version ${selectedVersionId?.slice(1, 5)}` : 'editor'}</b>
            {diffScripts && (
              <button
                onClick={() => setSelectedVersionId(null)}
                className="text-neutral-500 hover:text-neutral-800"
              >
                ← back to editing
              </button>
            )}
          </div>
          {diffScripts ? (
            <VersionViewer script={diffScripts.after} previousScript={diffScripts.before} />
          ) : (
            <Editor readOnly={isSharedView} />
          )}
        </Box>
        <div
          onMouseDown={handleMouseDown}
          className="w-2 cursor-col-resize hover:bg-gray-300 transition-colors shrink-0"
        />
        <Box style={{ width: `${100 - leftWidth}%` }}>
          <div className="flex h-10 items-center justify-between gap-1 border-b-2 p-2">
            <h1>player</h1>
          </div>
          <div className="h-[calc(100%-60px)] overflow-scroll m-2 relative">
            <Player />
          </div>
        </Box>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const rawProjectId = params.projectId as string;

  // Check if this is a share ID (encrypted project ID)
  const isSharedView = rawProjectId.startsWith('s_');
  const projectId = isSharedView ? decodeShareId(rawProjectId) : rawProjectId;

  // Validate that projectId looks like a Convex ID (not legacy "123")
  const isValidId = projectId && projectId.length > 10;

  if (!isValidId) {
    return (
      <div className="h-screen p-4 gap-2 flex flex-col">
        <div className="flex gap-2 items-center">
          <Header />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">Invalid project ID. Please select a project from the dropdown.</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={projectId as Id<'projects'>}>
      <PlayerProvider>
        <ProjectContent isSharedView={isSharedView} />
      </PlayerProvider>
    </ProjectProvider>
  );
}
