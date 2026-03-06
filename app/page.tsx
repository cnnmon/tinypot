'use client';

import Header from '@/components/Header';
import { useProjects } from '@/lib/project/ProjectsProvider';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const { createProject, deleteProject, renameProject, projectKeys, projects, isLoading } = useProjects();

  const yourProjects = projects.filter((p) => projectKeys.includes(p._id));

  return (
    <div className="h-screen p-4 gap-2 flex flex-col items-center">
      <div className="w-full max-w-2xl">
      <div className="flex gap-2 items-center">
        <Header />
      </div>

      <div className="flex-1 flex justify-start flex-col gap-4">
        <p>Bonsai is a tool for authoring a self-growing game in natural plaintext. <a href="/help" className="text-blue-500 hover:text-blue-700">Learn about it</a>.</p>

        <hr className="border-t-1" />

        <div className="flex gap-4">
          <button onClick={() => createProject()} className="w-fit text-blue-500 hover:text-blue-700">
            + New game
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
          {!isLoading && yourProjects.length === 0 && (
            <p>You don't have any games yet. <button onClick={() => createProject()} className="text-blue-500 hover:text-blue-700">Create a game</button> to get started.</p>
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
                      renameProject(project._id, prompt('Enter new name', project.name) ?? project.name);
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
          <div className="flex gap-2">
            {[
              { name: 'fireplace', imageUrl: 'https://i.imgur.com/dWaQH2c.gif', shareId: 's_amQ3ZWJ2aHcydm5kdmZmNm5reTI4ajB3czE3ejlhenM' },
              { name: 'escaperoom', imageUrl: 'https://i.imgur.com/PR6oN9P.png', shareId: 's_amQ3OGMwazdndnNmM2hwcXlid2NiM2YxOTk3eW14Z2g' },
              { name: 'lifesim', imageUrl: 'https://i.imgur.com/XxcNmXj.png', shareId: 's_amQ3ZnZxaHFmNDZyenJoZWYzNm5uNHpkN2Q4MGhqZ2s' }
            ].map((project) => (
              <button
                key={project.shareId}
                onClick={() => router.push(`/edit/${project.shareId}`)}
                className="text-center cursor-pointer group justify-between"
              >
                <Image width={100} height={100} className="h-30 w-auto" src={project.imageUrl} alt={project.name} />
                <p className="group-hover:underline">{project.name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
