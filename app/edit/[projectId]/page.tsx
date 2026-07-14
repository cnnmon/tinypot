'use client';

import AuthButton from '@/components/AuthButton';
import Box from '@/components/Box';
import BranchesCard from '@/components/BranchesCard';
import Editor from '@/components/Editor';
import Header from '@/components/Header';
import Player from '@/components/Player';
import ProjectSwitcher from '@/components/ProjectSwitcher';
import ScrollContainer from '@/components/ScrollContainer';
import { getDiffScripts } from '@/components/Versions/utils/getDiffScripts';
import VersionViewer from '@/components/VersionViewer';
import WorldBibleCard from '@/components/WorldBibleCard';
import { Id } from '@/convex/_generated/dataModel';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { PlayerProvider, usePlayerContext } from '@/lib/player/PlayerProvider';
import { ProjectProvider, useProject } from '@/lib/project';
import { decodeShareId, getShareUrl } from '@/lib/share';
import { useParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ProjectContent({ isSharedView = false }: { isSharedView?: boolean }) {
  const { project, versions, selectedVersionId, saveStatus, setSelectedVersionId, canEdit } = useProject();
  const { currentSceneId, variables } = usePlayerContext();
  const { isAdmin } = useCurrentUser();
  // Admins can edit even through shared links
  const isReadOnly = (isSharedView && !isAdmin) || !canEdit;

  // Resizable split between editor (left) and player (right). Sidebar is fixed-width.
  const [editorPct, setEditorPct] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hasDiff = getDiffScripts(selectedVersionId, versions) !== null;

  const handleShare = useCallback(() => window.open(getShareUrl(project.id), '_blank'), [project.id]);

  const handleSplitMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setEditorPct(Math.min(Math.max(pct, 20), 80));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className="h-screen flex flex-col p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Header />
          <ProjectSwitcher readOnly={isReadOnly} />
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <span
              className={twMerge(
                'transition-opacity',
                saveStatus === 'saving' && 'text-neutral-500 animate-pulse',
                saveStatus === 'saved' && 'text-green-600',
                saveStatus === 'idle' && 'opacity-0',
              )}
            >
              {saveStatus === 'saving' ? 'saving...' : saveStatus === 'saved' ? 'saved' : ''}
            </span>
          )}
          {!isSharedView && !canEdit && <span className="opacity-60">view-only</span>}
          <button onClick={() => window.open('/help', '_blank')}>help</button>
          {!isReadOnly && <button onClick={handleShare}>share</button>}
          <AuthButton />
        </div>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left sidebar */}
        <aside className="flex flex-col gap-3 w-60 shrink-0 min-h-0">
          <WorldBibleCard readOnly={isReadOnly} />
          <BranchesCard />
        </aside>

        {/* Editor + Player split */}
        <div ref={splitRef} className="flex flex-1 min-w-0">
          <Box style={{ width: `${editorPct}%` }}>
            <div className="flex items-center justify-between gap-1 border-b-2 p-2">
              <h2 className="flex items-center gap-2">
                {hasDiff ? `version ${selectedVersionId?.slice(1, 5)}` : 'Editor'}
              </h2>
              {hasDiff && (
                <button
                  onClick={() => setSelectedVersionId(null)}
                  className="text-neutral-500 hover:bg-black hover:text-white"
                >
                  ← back to editing
                </button>
              )}
            </div>
            {hasDiff ? <VersionViewer /> : <Editor readOnly={isReadOnly} />}
          </Box>

          <div
            onMouseDown={handleSplitMouseDown}
            className="w-2 cursor-col-resize hover:bg-neutral-200 transition-colors shrink-0"
          />

          <Box style={{ width: `${100 - editorPct}%` }}>
            <div className="flex items-center justify-between gap-1 border-b-2 p-2">
              <h2>Player</h2>
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-1">
                  <span className="opacity-50">Scene</span>
                  <span className="font-bold">{currentSceneId}</span>
                </div>
                <ScrollContainer direction="horizontal" className="flex gap-2">
                  {variables.length > 0 &&
                    variables.map((v, i) => (
                      <p key={i} className="flex flex-wrap min-w-fit px-1.5 py-0.5 bg-[#EBF7D2]">
                        {v}
                      </p>
                    ))}
                </ScrollContainer>
              </div>
            </div>
            <div className="p-2 overflow-scroll relative h-full">
              <Player />
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const { isLoading: isLoadingUser, userId, isAdmin } = useCurrentUser();
  const rawProjectId = params.projectId as string;

  const isSharedView = rawProjectId.startsWith('s_');
  const projectId = isSharedView ? decodeShareId(rawProjectId) : rawProjectId;
  const isValidId = projectId && projectId.length > 10;

  if (!isValidId) {
    return (
      <div className="h-screen p-4 flex flex-col gap-2">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">Invalid project ID. Please select a project from the dropdown.</p>
        </div>
      </div>
    );
  }

  if (!isSharedView && isLoadingUser) {
    return (
      <div className="h-screen p-4 flex flex-col gap-2">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-neutral-400">Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider projectId={projectId as Id<'projects'>} viewerUserId={userId} viewerIsAdmin={isAdmin}>
      <PlayerProvider>
        <ProjectContent isSharedView={isSharedView} />
      </PlayerProvider>
    </ProjectProvider>
  );
}
