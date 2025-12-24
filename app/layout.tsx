import { ProjectProvider } from '@/lib/project';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'tinypot',
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
        <ProjectProvider projectId="123">{children}</ProjectProvider>
      </body>
    </html>
  );
}
