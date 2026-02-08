'use client';

import { api } from '@/convex/_generated/api';
import { MetalearningRequest } from '@/app/api/metalearning/route';
import { parseGuidebook, serializeGuidebook } from '@/lib/guidebook';
import { Entity } from '@/types/entities';
import { useMutation } from 'convex/react';
import { useCallback, useMemo, useState } from 'react';
import { useProject } from '../project';
import { parseIntoSchema } from '../project/parser';
import { computeBlame, LineBlame } from './blame';

export default function useEditor() {
  const { project, updateProject, versions, setIsMetalearning } = useProject();
  const resolveAllMutation = useMutation(api.versions.resolveAll);
  const [cursorLine, setCursorLine] = useState<number>(0);

  const schema = useMemo(() => {
    return parseIntoSchema(project.script);
  }, [project.script]);

  // Compute blame for all lines (only unresolved AI versions for highlighting)
  const blame = useMemo(() => {
    return computeBlame(project.script, versions, true);
  }, [project.script, versions]);

  // Check if there are any unresolved AI-authored lines
  const hasUnresolvedAiLines = useMemo(() => {
    return blame.some((b) => b === Entity.SYSTEM);
  }, [blame]);

  // Get blame for the current cursor line
  const currentLineBlame = useMemo((): LineBlame => {
    if (cursorLine < 0 || cursorLine >= blame.length) return null;
    return blame[cursorLine];
  }, [blame, cursorLine]);

  function setScript(newScript: string[]) {
    updateProject({ script: newScript });
  }

  const updateCursorLine = useCallback((line: number) => {
    setCursorLine(line);
  }, []);

  // Dismiss highlights: check edits, run metalearning, then resolve
  const dismissHighlights = useCallback(async () => {
    // Find the most recent unresolved AI version
    const unresolvedAiVersion = versions.find((v) => v.creator === Entity.SYSTEM && !v.resolved);
    
    if (unresolvedAiVersion) {
      const generated = unresolvedAiVersion.snapshot.script.join('\n');
      const authored = project.script.join('\n');
      
      // Check if there are actual edits
      if (generated !== authored) {
        console.log('=== METALEARNING: Detected edits ===');
        console.log('GENERATED:\n', generated);
        console.log('AUTHORED:\n', authored);
        
        // Show loading state
        setIsMetalearning(true);
        
        // Kick off metalearning
        try {
          const response = await fetch('/api/metalearning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              generated,
              authored,
              existingGuidebook: project.guidebook,
            } satisfies MetalearningRequest),
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('=== METALEARNING RESULT ===', data);
            
            // If we got a new rule, add it to the guidebook
            if (data.newRule) {
              const settings = parseGuidebook(project.guidebook);
              settings.rules.push(data.newRule);
              updateProject({ guidebook: serializeGuidebook(settings) });
            }
          }
        } catch (err) {
          console.error('Metalearning failed:', err);
        } finally {
          setIsMetalearning(false);
        }
      } else {
        console.log('=== METALEARNING: No edits detected ===');
      }
    }
    
    // Resolve all versions
    resolveAllMutation({ projectId: project.id });
  }, [resolveAllMutation, project.id, project.script, project.guidebook, versions, updateProject, setIsMetalearning]);

  return {
    script: project.script,
    setScript,
    schema,
    blame,
    cursorLine,
    currentLineBlame,
    updateCursorLine,
    hasUnresolvedAiLines,
    dismissHighlights,
  };
}
