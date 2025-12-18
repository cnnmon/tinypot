'use client';

import { useProject } from '@/context/project';
import { useState } from 'react';

export function useGame() {
  const project = useProject();
  const [currentLineIdx, setCurrentLineIdx] = useState(0);

  return {
    currentLine: project.schema[currentLineIdx],
    handleNextLine: () => setCurrentLineIdx((idx) => idx + 1),
    handlePreviousLine: () => setCurrentLineIdx((idx) => idx - 1),
  };
}
