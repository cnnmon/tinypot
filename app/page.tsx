'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Branchbar from '@/components/Editor/Branchbar';
import GuidebookModal from '@/components/GuidebookModal';
import Header from '@/components/Header';
import Player from '@/components/Player';
import { useProject } from '@/lib/project';
import { useCallback, useRef, useState } from 'react';

export default function Home() {
  const { guidebook, setGuidebook, isGuidebookUpdating } = useProject();
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
      <Header />
      <GuidebookModal
        isOpen={guidebookOpen}
        onClose={() => setGuidebookOpen(false)}
        guidebook={guidebook}
        onSave={setGuidebook}
        isUpdating={isGuidebookUpdating}
      />

      <div className="flex gap-2">
        <Box
          className="bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white min-h-45 w-5 cursor-pointer hover:opacity-90"
          onClick={() => setGuidebookOpen(true)}
        >
          {isGuidebookUpdating && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full animate-pulse self-start">
              Updating...
            </span>
          )}
          <p className="line-clamp-4">{guidebook || 'Author is making a game about...'}</p>
        </Box>

        <Box className="max-h-45 overflow-auto select-none">
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
