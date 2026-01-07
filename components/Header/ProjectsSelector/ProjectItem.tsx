import { Project } from '@/types/project';

export default function ProjectItem({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className="w-full text-left px-3 py-2 hover:bg-neutral-50 bg-transparent! no-underline!"
      onClick={() => onSelect(project.id)}
    >
      <span className="truncate block">{project.name}</span>
    </button>
  );
}
