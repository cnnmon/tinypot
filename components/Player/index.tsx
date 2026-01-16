'use client';

import { Status, usePlayerContext } from '@/lib/player/PlayerProvider';
import { useProject } from '@/lib/project';
import { Sender } from '@/types/playthrough';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import PlayerInput from './PlayerInput';

export default function Player() {
  const { lines, status, handleSubmit, currentSceneId, variables, updateLineText } =
    usePlayerContext();
  const { project, setProject, readOnly } = useProject();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const handleEditSave = (originalText: string, lineIdx: number) => {
    if (editText.trim() && editText !== originalText) {
      // Update the displayed line immediately
      updateLineText(lineIdx, editText.trim());
      // Find and replace the text in the script
      const updatedScript = project.script.map((line) =>
        line.trim() === originalText.trim()
          ? line.replace(originalText.trim(), editText.trim())
          : line,
      );
      setProject({ script: updatedScript });
    }
    setEditingIdx(null);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [lines]);

  return (
    <>
      {/* State */}
      <div>
        <p>
          Currently at <span className="font-bold">{currentSceneId}</span>.
          {variables.length > 0 && (
            <>
              {' '}
              You have: <span className="font-bold">{variables.join(', ')}</span>
            </>
          )}
        </p>
      </div>

      {/* Lines */}
      <div className="space-y-2 flex flex-col relative justify-between h-full pt-3">
        <div ref={scrollRef} className="flex flex-col gap-2 h-full overflow-scroll">
          {lines.map((line, i) => {
            const isPlayer = line.sender === Sender.PLAYER;
            const isImage = line.type === 'image';

            if (isImage) {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <img src={line.text} alt={line.text} className="max-w-full max-h-40 rounded" />
                </motion.div>
              );
            }

            const isNarrator = line.sender === Sender.NARRATOR;
            const isEditing = editingIdx === i;
            const canEdit = isNarrator && !readOnly;

            return (
              <motion.div
                key={i}
                className={twMerge(
                  line.sender === Sender.SYSTEM && 'italic text-neutral-400 text-sm',
                  isPlayer && 'text-[#468D52]',
                  canEdit && 'cursor-pointer hover:bg-neutral-50 -mx-1 px-1 rounded',
                )}
                initial={isPlayer ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1, ease: 'easeInOut' }}
                onClick={() => {
                  if (canEdit && !isEditing) {
                    setEditingIdx(i);
                    setEditText(line.text);
                  }
                }}
              >
                {isPlayer && '> '}
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => handleEditSave(line.text, i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(line.text, i);
                      if (e.key === 'Escape') setEditingIdx(null);
                    }}
                    className="w-full bg-transparent border-b border-neutral-300 outline-none"
                    autoFocus
                  />
                ) : (
                  line.text
                )}
              </motion.div>
            );
          })}
          {status !== Status.WAITING &&
            (status === Status.ENDED ? (
              <p>END.</p>
            ) : (
              <p className="italic text-neutral-400">({status.toLowerCase()}...)</p>
            ))}
          <div ref={endRef} />
        </div>
      </div>

      <motion.div
        id={lines.length.toString()}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PlayerInput handleSubmit={handleSubmit} />
      </motion.div>
    </>
  );
}
