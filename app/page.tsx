'use client';

import Box from '@/components/Box';
import Editor from '@/components/Editor';
import Branchbar from '@/components/Editor/Branchbar';
import Header from '@/components/Header';
import Player from '@/components/Player';
import { useCallback, useRef, useState } from 'react';

export default function Home() {
  const [leftWidth, setLeftWidth] = useState(50);
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

      <div className="flex gap-2">
        <Box className="bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white min-h-45 w-5">
          <p>Author is making a game about...</p>
        </Box>

        <Box className="max-h-45 overflow-auto">
          <Branchbar />
        </Box>
      </div>

      <div
        ref={containerRef}
        className="flex flex-row min-h-[calc(100%-210px)] h-[calc(100%-210px)] pb-5"
      >
        <Box style={{ width: `${leftWidth}%` }}>
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
