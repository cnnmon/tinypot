'use client';

import { GuidebookSettings, getCreativityLabel, parseGuidebook, serializeGuidebook } from '@/lib/guidebook';
import { useProject } from '@/lib/project';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export default function Guidebook({ readOnly = false }) {
  const { project, updateProject } = useProject();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState('');

  const settings = useMemo(() => parseGuidebook(project.guidebook), [project.guidebook]);

  const updateSettings = useCallback(
    (partial: Partial<GuidebookSettings>) => {
      const updated = { ...settings, ...partial };
      updateProject({ guidebook: serializeGuidebook(updated) });
    },
    [settings, updateProject],
  );

  const addRule = useCallback(() => {
    if (!newRule.trim()) return;
    updateSettings({ rules: [...settings.rules, newRule.trim()] });
    setNewRule('');
  }, [newRule, settings.rules, updateSettings]);

  const removeRule = useCallback(
    (index: number) => {
      updateSettings({ rules: settings.rules.filter((_, i) => i !== index) });
    },
    [settings.rules, updateSettings],
  );

  // Close modal on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModalOpen]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
        onClick={() => setIsModalOpen(false)}
      >
        <div
          className="bordered bg-white w-full max-w-lg max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 p-3">
            <h2 className="font-bold">Guidebook Settings</h2>
            <button onClick={() => setIsModalOpen(false)}>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-6">
            {/* Creativity Slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-medium">AI Freedom</label>
                <span className="text-sm px-2 py-0.5 bg-neutral-100 border border-neutral-300">
                  {getCreativityLabel(settings.creativity)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.creativity}
                onChange={(e) => updateSettings({ creativity: parseFloat(e.target.value) })}
                disabled={readOnly}
                className="w-full accent-black"
              />
              <div className="flex justify-between text-xs opacity-60">
                <span>Very Limited</span>
                <span>Pretty Limited</span>
                <span>Totally Free</span>
              </div>
              <p className="text-xs opacity-60 mt-1">
                {settings.creativity <= 0.33
                  ? 'Inline text only — no scene jumps or variable changes'
                  : settings.creativity <= 0.66
                    ? 'Can use existing scenes & variables, but cannot create new ones'
                    : 'Can freely create new scenes and variables'}
              </p>
            </div>

            {/* Verbosity */}
            <div className="flex flex-col gap-2">
              <label className="font-medium">Response Length</label>
              <div className="flex gap-2">
                {(['terse', 'normal', 'verbose'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => updateSettings({ verbosity: v })}
                    disabled={readOnly}
                    className={twMerge(
                      'flex-1 py-1 border-2 border-black text-sm capitalize',
                      settings.verbosity === v ? 'bg-black text-white' : 'bg-white',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="flex flex-col gap-2">
              <label className="font-medium">Author Rules</label>
              <p className="text-xs opacity-60">Prompts the AI will follow for all generations</p>

              {/* Rule chips */}
              {settings.rules.length > 0 && (
                <div className="flex flex-wrap gap-2 py-2">
                  {settings.rules.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 bg-neutral-100 border border-neutral-300 rounded px-2 py-1 text-sm"
                    >
                      <span className="max-w-60 truncate" title={rule}>
                        {rule}
                      </span>
                      {!readOnly && (
                        <button
                          onClick={() => removeRule(i)}
                          className="text-neutral-400 hover:text-red-500"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new rule */}
              {!readOnly && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRule()}
                    placeholder="Add a rule..."
                    className="flex-1 px-2 py-1 border-2 border-black"
                  />
                  <button
                    onClick={addRule}
                    disabled={!newRule.trim()}
                    className="px-3 py-1 border-2 border-black bg-black text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
