import ConvexClientProvider from '@/components/ConvexClientProvider';
import { TooltipProvider } from '@/components/TooltipProvider';
import { ProjectsProvider } from '@/lib/project/ProjectsProvider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'bonsai',
  description: 'shape a game that grows by itself',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ConvexClientProvider>
          <ProjectsProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ProjectsProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
