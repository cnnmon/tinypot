import ConvexClientProvider from '@/components/ConvexClientProvider';
import { TooltipProvider } from '@/components/TooltipProvider';
import { ProjectKeysProvider } from '@/lib/project/ProjectKeysProvider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'bonsai',
  description: 'to grow your bonsai',
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
          <ProjectKeysProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ProjectKeysProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
