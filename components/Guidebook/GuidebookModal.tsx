'use client';

import { GuidebookSettings, getCreativityLabel } from '@/lib/guidebook';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

type DialOption = {
  key: string;
  label: string;
  hint: string;
};

function Dial({
  title,
  valueKey,
  options,
  onSelect,
  disabled,
}: {
  title: string;
  valueKey: string;
  options: DialOption[];
  onSelect: (nextKey: string) => void;
  disabled: boolean;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === valueKey),
  );
  const total = options.length;
  const arcStart = -140;
  const arcEnd = 140;
  const angleAt = (index: number) => (total <= 1 ? 0 : arcStart + (index * (arcEnd - arcStart)) / (total - 1));
  const activeAngle = angleAt(activeIndex);

  return (
    <div className="flex flex-col gap-3">
      <div className="uppercase opacity-60">{title}</div>
      <div className="flex items-center gap-4">
        <div className="relative h-32 w-32 rounded-full border-2 border-black bg-white">
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
          <div
            className="absolute left-1/2 top-1/2 h-[2px] w-12 -translate-y-1/2 rounded bg-black origin-left transition-transform"
            style={{ transform: `translateY(-50%) rotate(${activeAngle}deg)` }}
          />

          {options.map((option, index) => {
            const angle = angleAt(index);
            const radians = (angle * Math.PI) / 180;
            const radius = 44;
            const left = 64 + Math.cos(radians) * radius;
            const top = 64 + Math.sin(radians) * radius;
            const selected = option.key === valueKey;

            return (
              <button
                key={option.key}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(option.key)}
                className={twMerge(
                  'absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black transition-colors',
                  selected ? 'bg-black' : 'bg-white hover:bg-neutral-200',
                )}
                style={{ left: `${left}px`, top: `${top}px` }}
                aria-label={option.label}
                title={option.label}
              />
            );
          })}
        </div>

        <div className="flex flex-col gap-2 w-[70%]">
          {options.map((option) => {
            const selected = option.key === valueKey;
            return (
              <button
                key={option.key}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(option.key)}
                className={twMerge(
                  'text-left bordered px-2 py-1 transition-colors',
                  selected ? 'bg-black text-white' : 'bg-white hover:bg-neutral-100',
                )}
              >
                <div>{option.label}</div>
                <div className={twMerge('opacity-60', selected && 'opacity-85')}>{option.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function GuidebookModal({
  readOnly,
  onClose,
  onSave,
  settings,
  rulesText,
  onRulesTextChange,
  onCreativityChange,
  onVerbosityChange,
}: {
  readOnly: boolean;
  onClose: () => void;
  onSave: () => void;
  settings: GuidebookSettings;
  rulesText: string;
  onRulesTextChange: (value: string) => void;
  onCreativityChange: (value: number) => void;
  onVerbosityChange: (value: GuidebookSettings['verbosity']) => void;
}) {
  const creativityOptions: DialOption[] = [
    { key: 'controlled', label: 'Controlled', hint: 'Inline text only' },
    { key: 'limited', label: 'Limited', hint: 'Use existing scenes and vars' },
    { key: 'unrestricted', label: 'Unrestricted', hint: 'Can create new branches freely' },
  ];

  const creativityKey =
    settings.creativity <= 0.33 ? 'controlled' : settings.creativity <= 0.66 ? 'limited' : 'unrestricted';

  const handleCreativitySelect = (key: string) => {
    if (key === 'controlled') onCreativityChange(0.16);
    else if (key === 'limited') onCreativityChange(0.5);
    else onCreativityChange(0.84);
  };

  const verbosityOptions: DialOption[] = [
    { key: 'terse', label: 'Terse', hint: '1-2 short sentences' },
    { key: 'normal', label: 'Normal', hint: 'Balanced pacing and detail' },
    { key: 'verbose', label: 'Verbose', hint: 'Detailed, atmospheric writing' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bordered bg-white w-full max-w-5xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 p-3">
          <div>
            <h2>Guidebook</h2>
            <p className="opacity-60">Minimal controls for how new branches are generated.</p>
          </div>
          <button onClick={onClose} aria-label="Close guidebook modal">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-[0.8fr_1fr]">
          <section className="p-4 border-b-2 md:border-b-0 md:border-r-2 flex flex-col gap-6">
            <Dial
              title="Creativity"
              valueKey={creativityKey}
              options={creativityOptions}
              onSelect={handleCreativitySelect}
              disabled={readOnly}
            />
            <Dial
              title="Response Length"
              valueKey={settings.verbosity}
              options={verbosityOptions}
              onSelect={(next) => onVerbosityChange(next as GuidebookSettings['verbosity'])}
              disabled={readOnly}
            />
          </section>

          <section className="p-4 flex flex-col gap-3 bg-white">
            <div>
              <h3>Branch Prompt Rules</h3>
              <p className="opacity-60">Optional constraints for AI-generated branch content. One rule per line.</p>
            </div>

            <textarea
              value={rulesText}
              onChange={(e) => onRulesTextChange(e.target.value)}
              disabled={readOnly}
              className="bordered min-h-48 p-2 resize-y"
              placeholder="Keep tone grounded in small-town mystery; avoid jump scares; favor dialogue over exposition"
            />
          </section>
        </div>

        {!readOnly && (
          <div className="flex items-center justify-end gap-2 border-t-2 p-3 bg-white">
            <button onClick={onClose} className="bordered px-3 py-1 bg-white">
              Cancel
            </button>
            <button onClick={onSave} className="bordered px-3 py-1 bg-black text-white">
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
