'use client';

import Box from '@/components/Box';
import BranchList from '@/components/BranchList';
import Editor from '@/components/Editor';
import Header from '@/components/Header';
import Player from '@/components/Player';

export default function Home() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <Header />

      <div className="flex gap-2">
        <Box
          title="World Bible"
          icon="folderOpen"
          className="bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white min-h-45 w-5"
        >
          <p>Author is making an escape room game with secrets.</p>
        </Box>

        <Box title="Branches" icon="leaf">
          <BranchList />
        </Box>
      </div>

      <div className="flex flex-row gap-2 h-[calc(100%-50px)]">
        <Box title="Editor" icon="scissors" className="w-1/2">
          <Editor />
        </Box>
        <Box title="Player" icon="hourglass" className="w-1/2">
          <Player />
        </Box>
      </div>
    </div>
  );
}
