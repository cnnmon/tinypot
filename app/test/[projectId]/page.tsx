'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Header from '@/components/Header';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { ProjectProvider, useProject } from '@/lib/project';
import { useProjects } from '@/lib/project/ProjectsProvider';
import { getShareUrl } from '@/lib/share';
import { PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import BranchesModal from './BranchesModal';
import Table from './Table';

function ProjectContent() {
  const { project, unresolvedBranches } = useProject();
  const { renameProject } = useProjects();
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showBranchesModal, setShowBranchesModal] = useState(false);

  const handleShare = useCallback(() => {
    const shareUrl = getShareUrl(project.id);
    window.open(shareUrl, '_blank');
  }, [project.id]);

  return (
    <>
      {/* Script Editor Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/50 p-3 flex items-center justify-center z-[10]">
          <Box
            header={
              <>
                <b>editor</b>
                <button onClick={() => setShowScriptModal(false)}>
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </>
            }
            className="w-full max-w-3xl h-full bg-white"
          >
            <Editor />
          </Box>
        </div>
      )}

      {/* Branches Modal */}
      {showBranchesModal && <BranchesModal onClose={() => setShowBranchesModal(false)} />}

      <div className="h-screen p-4 gap-2 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Header />
            <div className="flex items-center gap-2 group">
              <p>{project.name}</p>
              <button
                onClick={() =>
                  renameProject(
                    project.id as Id<'projects'>,
                    prompt('Enter new name', project.name) ?? project.name,
                  )
                }
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => window.open('/help', '_blank')} className="px-1">
              help
            </button>
            <button onClick={() => setShowBranchesModal(true)} className="px-1">
              edit ({unresolvedBranches.length})
            </button>
            <button onClick={handleShare} className="px-1">
              share
            </button>
          </div>
        </div>

        <div className="flex flex-row min-h-[calc(100%-210px)] h-[calc(100%-210px)] pb-5 gap-2">
          <div className="flex flex-col gap-2 w-50">
            <b>navigation</b>
            <Table />
          </div>
          <div className="w-full max-w-xl">
            <div className="h-[calc(100%-60px)] m-2 relative">
              <Player />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Convex IDs don't start with 's_' (that's our share prefix)
  // They also follow a specific format - basic check for obviously invalid IDs
  const isValidIdFormat = projectId && !projectId.startsWith('s_') && projectId.length > 10;

  if (!isValidIdFormat) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-neutral-400">Invalid project ID</p>
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
