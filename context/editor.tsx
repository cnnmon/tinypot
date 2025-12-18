'use client';

import { createContext, ReactNode, useContext } from 'react';
import { ParserOutput, useParser } from '../hooks/parser';
import { useProject } from './project';

interface EditorContextType extends ParserOutput {}
const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const project = useProject();
  const parserProps = useParser({ initialSchema: project.schema });
  return <EditorContext.Provider value={parserProps}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within a EditorProvider');
  }
  return context;
}
