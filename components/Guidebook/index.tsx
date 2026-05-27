'use client';

import { GuidebookSettings, parseGuidebook, serializeGuidebook } from '@/lib/guidebook';
import { useProject } from '@/lib/project';
import GuidebookModal from './GuidebookModal';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function Guidebook({ readOnly = false, onClose }: { readOnly?: boolean, onClose: () => void }) {
  const { project, updateProject } = useProject();
  const settings = useMemo(() => parseGuidebook(project.guidebook), [project.guidebook]);
  const [draftSettings, setDraftSettings] = useState<GuidebookSettings>(settings);

  // Keep draft synced when source guidebook changes (or when modal re-opens with new data).
  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const updateSettings = useCallback(
    (partial: Partial<GuidebookSettings>) => {
      setDraftSettings((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const updateRulesFromText = useCallback(
    (text: string) => {
      const rules = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      updateSettings({ rules });
    },
    [updateSettings],
  );

  const handleSave = useCallback(() => {
    updateProject({ guidebook: serializeGuidebook(draftSettings) });
    onClose();
  }, [draftSettings, onClose, updateProject]);

  // Close modal on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <GuidebookModal
      readOnly={readOnly}
      onClose={onClose}
      settings={draftSettings}
      rulesText={draftSettings.rules.join('\n')}
      onRulesTextChange={updateRulesFromText}
      onCreativityChange={(creativity) => updateSettings({ creativity })}
      onVerbosityChange={(verbosity) => updateSettings({ verbosity })}
      onSave={handleSave}
    />
  );
}
