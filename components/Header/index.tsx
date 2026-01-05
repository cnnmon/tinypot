'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { DEFAULT_LINES } from '@/lib/project/constants';
import { addProjectKey, getProjectKeys } from '@/lib/project/storage';
import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import CaretDown from '../../public/icons/CaretDown.svg';
import BranchDesign from '../Editor/Branchbar/BranchDesign';

export default function Header() {
  const router = useRouter();
  const [randomNumber, setRandomNumber] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [projectKeys, setProjectKeys] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const createProjectMutation = useMutation(api.projects.create);

  // Load project keys from localStorage
  useEffect(() => {
    setRandomNumber(Math.random());
    setProjectKeys(getProjectKeys());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNewProject = async () => {
    setIsCreating(true);
    try {
      const project = await createProjectMutation({
        authorId: 'default-author',
        name: 'Untitled Project',
        description: '',
        script: DEFAULT_LINES,
        guidebook: '',
      });

      if (project) {
        addProjectKey(project._id);
        setProjectKeys(getProjectKeys());
        setIsDropdownOpen(false);
        router.push(`/${project._id}`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setIsDropdownOpen(false);
    router.push(`/${projectId}`);
  };

  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center gap-1">
        <p>tinypot</p>
        <div className="relative flex justify-center items-center mb-1">
          <BranchDesign seed={randomNumber} width={25} height={25} />
          <Image
            alt="plantpot"
            src="/icons/PlantPot.svg"
            width={15}
            height={15}
            className="absolute top-[12px]"
          />
        </div>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          className="flex items-center justify-center gap-1"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <p>Projects</p>
          <CaretDown
            width={20}
            className={`stroke-current transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg min-w-[200px] z-50">
            <button
              className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b border-neutral-100 font-medium bg-transparent! no-underline!"
              onClick={handleNewProject}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : '+ New project'}
            </button>

            {projectKeys.length > 0 && (
              <div className="max-h-[300px] overflow-auto">
                {projectKeys.map((projectId) => (
                  <ProjectItem
                    key={projectId}
                    projectId={projectId as Id<'projects'>}
                    onSelect={handleSelectProject}
                  />
                ))}
              </div>
            )}

            {projectKeys.length === 0 && (
              <p className="px-3 py-2 text-neutral-400 text-sm">No projects yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectItem({
  projectId,
  onSelect,
}: {
  projectId: Id<'projects'>;
  onSelect: (id: string) => void;
}) {
  const project = useQuery(api.projects.get, { projectId });

  return (
    <button
      className="w-full text-left px-3 py-2 hover:bg-neutral-50 bg-transparent! no-underline!"
      onClick={() => onSelect(projectId)}
    >
      <span className="truncate block">{project?.name || 'Loading...'}</span>
    </button>
  );
}
