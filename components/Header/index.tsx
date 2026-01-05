'use client';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { DEFAULT_LINES } from '@/lib/project/constants';
import { addProjectKey, getProjectKeys, removeProjectKey } from '@/lib/project/storage';
import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import CaretDown from '../../public/icons/CaretDown.svg';
import BranchDesign from '../Editor/Branchbar/BranchDesign';

interface HeaderProps {
  projectId?: string;
  projectName?: string;
  onUpdateName?: (name: string) => void;
}

export default function Header({ projectId, projectName, onUpdateName }: HeaderProps) {
  const router = useRouter();
  const [randomNumber, setRandomNumber] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [projectKeys, setProjectKeys] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(projectName || '');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createProjectMutation = useMutation(api.projects.create);
  const deleteProjectMutation = useMutation(api.projects.remove);

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

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(projectName || '');
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    if (onUpdateName && editName.trim()) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(projectName || '');
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    setIsDeleting(true);
    try {
      await deleteProjectMutation({ projectId: projectId as Id<'projects'> });
      removeProjectKey(projectId);
      setProjectKeys(getProjectKeys());
      router.push('/');
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayName = projectName || 'Projects';

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
        <div className="flex items-center gap-1">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="px-1 py-0.5 border border-neutral-300 rounded text-sm w-40"
            />
          ) : (
            <>
              <button
                className="flex items-center justify-center gap-1"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <p className="max-w-[200px] truncate">{displayName}</p>
                <CaretDown
                  width={20}
                  className={`stroke-current transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {projectId && projectName && onUpdateName && (
                <>
                  <button
                    onClick={handleStartEdit}
                    className="p-1 hover:bg-neutral-100 rounded"
                    title="Edit project name"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-1 hover:bg-red-50 rounded text-neutral-500 hover:text-red-600"
                    title="Delete project"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white bordered rounded-md shadow-lg min-w-[200px] z-50">
            <button
              className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b font-medium bg-transparent! no-underline!"
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
