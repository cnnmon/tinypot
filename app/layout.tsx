import ConvexClientProvider from '@/components/ConvexClientProvider';
import { TooltipProvider } from '@/components/TooltipProvider';
import { ProjectsProvider } from '@/lib/project/ProjectsProvider';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'bonsai',
  description: 'shape a game that grows by itself',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>
            <ProjectsProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </ProjectsProvider>
          </ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
