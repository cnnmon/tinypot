'use client';

import AuthButton from '@/components/AuthButton';
import ProjectCard from '@/components/ProjectCard';
import { useProjects } from '@/lib/project/ProjectsProvider';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const { createProject, deleteProject, renameProject, projects, isLoading } = useProjects();
  const yourProjects = projects;

  return (
    <div
      className="h-screen p-4 gap-2 flex flex-col items-center"
      style={{ background: 'linear-gradient(to bottom, #D1EBD5, #ffffff)' }}
    >
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div className="flex gap-2 items-center justify-end">
          <AuthButton />
        </div>

        <div className="flex justify-start flex-col gap-4 border-2 bg-white p-4 h-screen">
          <div>
            <div className="flex items-center">
              <Image src="/logo.png" alt="bonsai" width={300} height={300} />
            </div>

            <div className="flex items-center">
              <p>A plaintext game engine for self-growing interactive narratives.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => createProject()} className="display">
              + New game
            </button>
          </div>

          <div className="gap-2 flex flex-col">
            <h2>Featured games</h2>
            <div className="flex gap-2">
              {[
                {
                  name: 'fireplace',
                  imageUrl: 'https://i.imgur.com/dWaQH2c.gif',
                  shareId: 's_amQ3ZWJ2aHcydm5kdmZmNm5reTI4ajB3czE3ejlhenM',
                },
                {
                  name: 'escaperoom',
                  imageUrl: 'https://i.imgur.com/PR6oN9P.png',
                  shareId: 's_amQ3OGMwazdndnNmM2hwcXlid2NiM2YxOTk3eW14Z2g',
                },
                {
                  name: 'lifesim',
                  imageUrl: 'https://i.imgur.com/XxcNmXj.png',
                  shareId: 's_amQ3ZnZxaHFmNDZyenJoZWYzNm5uNHpkN2Q4MGhqZ2s',
                },
              ].map((project) => (
                <ProjectCard
                  key={project.shareId}
                  name={project.name}
                  imageUrl={project.imageUrl}
                  onClick={() => router.push(`/edit/${project.shareId}`)}
                />
              ))}
            </div>
          </div>

          <div className="gap-2 flex flex-col">
            <h2>Your games</h2>
            {isLoading && (
              <div className="flex gap-2 flex-wrap animate-pulse">
                <div className="h-20 bg-gray-200 w-full" />
              </div>
            )}
            {!isLoading && yourProjects.length === 0 && <p className="opacity-60">You do not have any games yet.</p>}
            <div className="flex gap-2 flex-wrap">
              {yourProjects.map((project) => (
                <ProjectCard
                  key={project._id}
                  name={project.name}
                  imageUrl="/branch.png"
                  onClick={() => router.push(`/edit/${project._id}`)}
                  menuItems={[
                    {
                      label: 'Edit',
                      icon: PencilIcon,
                      onClick: () => renameProject(project._id, prompt('Enter new name', project.name) ?? project.name),
                    },
                    {
                      label: 'Delete',
                      icon: TrashIcon,
                      onClick: () => {
                        if (confirm(`Are you sure you want to delete ${project.name}?`)) {
                          deleteProject(project._id);
                        }
                      },
                    },
                  ]}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
