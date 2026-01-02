'use client';

import { useState, useEffect } from 'react';

type GuidebookModalProps = {
  isOpen: boolean;
  onClose: () => void;
  guidebook: string;
  onSave: (guidebook: string) => void;
  isUpdating?: boolean;
};

export default function GuidebookModal({
  isOpen,
  onClose,
  guidebook,
  onSave,
  isUpdating = false,
}: GuidebookModalProps) {
  const [value, setValue] = useState(guidebook);

  useEffect(() => {
    setValue(guidebook);
  }, [guidebook]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (isUpdating) return;
    onSave(value);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white bordered p-4 w-[500px] max-w-[90vw] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <h2 className="font-medium">Guidebook</h2>
          {isUpdating && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full animate-pulse">
              Updating...
            </span>
          )}
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isUpdating}
          className={`w-full h-64 p-2 bordered resize-none focus:outline-none ${
            isUpdating ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
          }`}
          placeholder="Write notes about your game..."
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 bordered hover:bg-gray-100">
            {isUpdating ? 'Close' : 'Cancel'}
          </button>
          {!isUpdating && (
            <button
              onClick={handleSave}
              className="px-3 py-1 bordered bg-[#EBF7D2] hover:bg-[#d9edb5]"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

