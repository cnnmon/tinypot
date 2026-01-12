'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Header from '@/components/Header';
import ProjectsSelector from '@/components/Header/ProjectsSelector';
import Player from '@/components/Player';
import { Id } from '@/convex/_generated/dataModel';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { ProjectProvider } from '@/lib/project';

const EXAMPLE_PROJECT_ID = 'jd78c0k7gvsf3hpqybwcb3f1997ymxgh' as Id<'projects'>;

function ExampleProject() {
  return (
    <ProjectProvider projectId={EXAMPLE_PROJECT_ID} readOnly>
      <PlayerProvider>
        <div className="flex gap-2 h-[500px] w-full max-w-5xl">
          <Box className="w-1/2 overflow-hidden">
            <div className="flex min-h-8 items-center border-b-2 px-2">
              <span className="text-sm text-neutral-500">Editor (view only)</span>
            </div>
            <Editor readOnly />
          </Box>
          <Box className="w-1/2 overflow-hidden">
            <div className="flex min-h-8 items-center border-b-2 px-2">
              <span className="text-sm text-neutral-500">Player</span>
            </div>
            <div className="h-[calc(100%-48px)] relative m-2">
              <Player />
            </div>
          </Box>
        </div>
      </PlayerProvider>
    </ProjectProvider>
  );
}

export default function Home() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <div className="flex gap-2 items-center">
        <Header />
        <ProjectsSelector />
      </div>

      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <p>
          Look at{' '}
          <button onClick={() => window.open('/help', '_blank')} className="px-1">
            help
          </button>{' '}
          to get started. Click Projects to create your own game.
        </p>
        <p className="text-neutral-500">Or check out this example:</p>
        <ExampleProject />
      </div>
    </div>
  );
}
