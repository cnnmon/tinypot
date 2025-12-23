'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Player from '@/components/Game';
import Header from '@/components/Header';
import ArrowRight from '@icons/ArrowRight.svg';

export default function Home() {
  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <Header />
      <div className="flex flex-col md:flex-row gap-2 mt-2 h-[calc(100%-50px)]">
        <div className="flex flex-col gap-2 md:max-w-1/4">
          <Box
            title="World Bible"
            icon="folderOpen"
            className="bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white"
          >
            <p>Author is making an escape room game with secrets.</p>
          </Box>

          <Box title="Branches" icon="leaf">
            <p>Branches are the different paths the player can take in the game.</p>
            {['hello', 'world'].map((item) => (
              <button
                key={item}
                className="flex items-center justify-between w-full hover:bg-black hover:text-white"
                onClick={() => {}}
              >
                <b>{item}</b>
                <ArrowRight className="stroke-current w-8 h-8 scale-70" />
              </button>
            ))}
          </Box>
        </div>

        <Box title="Editor" icon="scissors">
          <Editor />
        </Box>
        <Box title="Player" icon="hourglass" className="w-[700px]">
          <Player />
        </Box>
      </div>
    </div>
  );
}
