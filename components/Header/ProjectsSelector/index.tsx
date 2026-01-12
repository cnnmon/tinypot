'use client';

import { useTooltipTrigger } from '@/components/TooltipProvider';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useProjectOptional } from '@/lib/project';
import { DEFAULT_LINES } from '@/lib/project/constants';
import { useProjectKeys } from '@/lib/project/ProjectKeysProvider';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ProjectItem from './ProjectItem';

export default function ProjectsSelector() {
  const projectContext = useProjectOptional();
  const project = projectContext?.project;
  const setProject = projectContext?.setProject;
  const { projects, addKey, removeKey } = useProjectKeys();

  const router = useRouter();
  const [editName, setEditName] = useState(project?.name || '');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createProjectMutation = useMutation(api.projects.create);
  const deleteProjectMutation = useMutation(api.projects.remove);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const editProjectTooltip = useTooltipTrigger('Edit project name');
  const deleteProjectTooltip = useTooltipTrigger('Delete project');

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

  const onUpdateName = (name: string) => {
    setProject?.({ name });
  };

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
        addKey(project._id);
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
    setEditName(project?.name || '');
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
      setEditName(project?.name || '');
    }
  };

  const handleDelete = async () => {
    if (!project?.id) return;
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    setIsDeleting(true);
    try {
      await deleteProjectMutation({ projectId: project.id as Id<'projects'> });
      removeKey(project.id);
      router.push('/');
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        {isEditing && project ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            className="px-1 py-0.5 border border-neutral-300 rounded w-40"
          />
        ) : (
          <>
            <button
              className="flex items-center justify-center gap-1"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <p className="max-w-[200px] truncate">{project?.name || 'Projects'}</p>
              {isDropdownOpen ? (
                <ChevronUpIcon width={14} height={14} />
              ) : (
                <ChevronDownIcon width={14} height={14} />
              )}
            </button>
            {project && (
              <>
                <button onClick={handleStartEdit} className="p-1 rounded" {...editProjectTooltip}>
                  <PencilSquareIcon width={14} height={14} />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1 rounded"
                  {...deleteProjectTooltip}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white bordered rounded-md min-w-[200px] z-50">
          <button
            className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b  bg-transparent! no-underline!"
            onClick={handleNewProject}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : '+ New project'}
          </button>

          {projects.length > 0 && (
            <div className="max-h-[300px] overflow-auto">
              {projects.map((p) => (
                <ProjectItem
                  key={p._id}
                  project={{ id: p._id, ...p }}
                  onSelect={handleSelectProject}
                />
              ))}
            </div>
          )}

          {projects.length === 0 && <p className="p-3 text-neutral-400">No projects yet</p>}
        </div>
      )}
    </div>
  );
}
