'use client';

import Guidebook from '@/components/Guidebook';
import { parseGuidebook } from '@/lib/guidebook';
import { useProject } from '@/lib/project';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * Sidebar card showing the project's "world bible" (rules from the guidebook).
 * Clicking opens the existing Guidebook editor modal.
 */
export default function WorldBibleCard({ readOnly = false }: { readOnly?: boolean }) {
  const { project, isMetalearning } = useProject();
  const [openEditor, setOpenEditor] = useState(false);
  const settings = useMemo(() => parseGuidebook(project.guidebook), [project.guidebook]);

  const summary =
    settings.rules.length > 0 ? settings.rules.join('\n') : 'No rules yet. Click to add what your game is about.';

  return (
    <>
      <button
        onClick={() => setOpenEditor(true)}
        className={twMerge(
          'group flex flex-col bordered text-left cursor-pointer hover:opacity-95 transition-opacity',
          'bg-gradient-to-b from-[#EBF7D2] via-[#B7DCBD] to-white',
          isMetalearning && 'bg-gradient-to-b from-red-300 via-red-200 to-white animate-pulse',
        )}
      >
        <div className="p-2 border-b-2 flex items-center justify-between">
          <h2 className="cursor-default">Guidebook</h2>
          <ArrowsPointingOutIcon className="w-4 h-4 opacity-50 group-hover:opacity-100" />
        </div>
        <p className="p-2 whitespace-pre-line line-clamp-6">{summary}</p>
      </button>

      {openEditor && <Guidebook readOnly={readOnly} onClose={() => setOpenEditor(false)} />}
    </>
  );
}
