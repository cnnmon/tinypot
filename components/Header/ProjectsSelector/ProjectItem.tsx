import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';

export default function ProjectItem({
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
