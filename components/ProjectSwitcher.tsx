'use client';

import { useProject } from '@/lib/project';
import { useProjects } from '@/lib/project/ProjectsProvider';
import { ChevronDownIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export default function ProjectSwitcher({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const { project } = useProject();
  const { projects, projectKeys, createProject, renameProject } = useProjects();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const yourProjects = projects.filter((p) => projectKeys.includes(p._id));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 hover:bg-neutral-100 px-2 py-1"
      >
        <span>{project.name}</span>
        {readOnly && <span className="text-neutral-400">(view-only)</span>}
        <ChevronDownIcon className="w-4 h-4 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-56 bordered bg-white shadow-md z-20">
          {!readOnly && (
            <button
              onClick={() => {
                const newName = prompt('Rename project', project.name);
                if (newName) renameProject(project.id, newName);
                setOpen(false);
              }}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-neutral-100 text-left"
            >
              <PencilIcon className="w-4 h-4 opacity-60" /> rename current
            </button>
          )}

          {yourProjects.length > 0 && (
            <>
              <div className="border-t border-neutral-200" />
              <div className="px-3 py-1 text-neutral-500">your games</div>
              {yourProjects.map((p) => (
                <button
                  key={p._id}
                  onClick={() => {
                    setOpen(false);
                    if (p._id !== project.id) router.push(`/edit/${p._id}`);
                  }}
                  className={twMerge(
                    'w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 text-left',
                    p._id === project.id && 'bg-neutral-50',
                  )}
                >
                  {p.name}
                </button>
              ))}
            </>
          )}

          <div className="border-t border-neutral-200" />
          <button
            onClick={() => {
              setOpen(false);
              createProject();
            }}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-neutral-100 text-left"
          >
            <PlusIcon className="w-4 h-4 opacity-60" /> new project
          </button>
        </div>
      )}
    </div>
  );
}
