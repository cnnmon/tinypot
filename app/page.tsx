'use client';

import Header from '@/components/Header';
import { useProjects } from '@/lib/project/ProjectsProvider';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const { createProject, deleteProject, renameProject, projectKeys, projects, isLoading } =
    useProjects();

  const yourProjects = projects.filter((p) => projectKeys.includes(p._id));

  return (
    <div className="h-screen p-4 gap-2 flex flex-col">
      <div className="flex gap-2 items-center">
        <Header />
      </div>

      <div className="flex-1 flex justify-start flex-col gap-4">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => createProject()}
            className="w-fit bg-[var(--mint)] hover:bg-black hover:text-white"
          >
            + new game
          </button>
          <button
            onClick={() => router.push('/help')}
            className="w-fit hover:bg-black hover:text-white"
          >
            help
          </button>
        </div>
        <div>
          <h1>Your games</h1>
          {isLoading && (
            <div className="flex flex-col gap-1 animate-pulse">
              {Array.from({ length: projectKeys.length }).map((_, index) => (
                <div key={index} className="h-6 w-30 bg-gray-200" />
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            {yourProjects.map((project) => (
              <div
                key={project._id}
                onClick={() => router.push(`/edit/${project._id}`)}
                className="flex items-center justify-between gap-1 group hover:bg-gray-100 cursor-pointer"
              >
                <span>{project.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      renameProject(
                        project._id,
                        prompt('Enter new name', project.name) ?? project.name,
                      );
                    }}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete ${project.name}?`)) {
                        deleteProject(project._id);
                      }
                    }}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h1>Other games</h1>
          <div className="flex flex-col gap-1">
            {[
              { name: 'fireplace', shareId: 's_amQ3ZWJ2aHcydm5kdmZmNm5reTI4ajB3czE3ejlhenM' },
              { name: 'escaperoom', shareId: 's_amQ3OGMwazdndnNmM2hwcXlid2NiM2YxOTk3eW14Z2g' },
            ].map((project) => (
              <button
                key={project.shareId}
                onClick={() => router.push(`/play/${project.shareId}`)}
                className="text-left hover:bg-gray-100 cursor-pointer"
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
