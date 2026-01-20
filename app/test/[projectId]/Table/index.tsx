import useEditor from '@/lib/editor';
import { usePlayerContext } from '@/lib/player/PlayerProvider';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';

interface SceneNode {
  name: string;
  lineIdx: number;
  choices: { text: string; lineIdx: number; requires?: string }[];
}

export default function Table() {
  const { script } = useEditor();
  const { replay, hasVariable, setVariable, unsetVariable } = usePlayerContext();
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const toggleVariable = (name: string) => {
    if (hasVariable(name)) {
      unsetVariable(name);
    } else {
      setVariable(name);
    }
  };

  // Extract all unique variables from the script
  const allVariables = useMemo(() => {
    const vars = new Set<string>();
    for (const line of script) {
      const trimmed = line.trim();
      // [sets: var], [unsets: var], [requires: var]
      const metaMatch = trimmed.match(/^\[(sets|unsets|requires):\s*([^\]]+)\]$/);
      if (metaMatch) vars.add(metaMatch[2].trim());
      // if [var] / when [var] / if [!var] / when [!var]
      const condMatch = trimmed.match(/^(?:if|when)\s+\[(!?)([^\]]+)\]\s*$/);
      if (condMatch) vars.add(condMatch[2].trim());
      // -> +var / -> -var / -> ?var
      const arrowMatch = trimmed.match(/->\s*(.+)$/);
      if (arrowMatch) {
        const effects = arrowMatch[1].split(/\s+/);
        for (const e of effects) {
          if (e.startsWith('+') || e.startsWith('-') || e.startsWith('?')) {
            vars.add(e.slice(1));
          }
        }
      }
      // & [var] suffix
      const suffixMatch = trimmed.match(/&\s*\[([^\]]+)\]\s*$/);
      if (suffixMatch) vars.add(suffixMatch[1].trim());
    }
    return Array.from(vars).sort();
  }, [script]);

  // Parse script into scene nodes with their choices
  const scenes = useMemo(() => {
    const result: SceneNode[] = [];
    let currentScene: SceneNode | null = null;
    // Track when blocks: { indent, condition }
    const whenStack: { indent: number; condition: string }[] = [];

    const getIndent = (line: string) => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    };

    for (let i = 0; i < script.length; i++) {
      const rawLine = script[i];
      const indent = getIndent(rawLine);
      const line = rawLine.trim();

      // Skip empty lines and metadata
      if (!line || line.startsWith('[')) continue;

      // Pop when blocks that we've exited (based on indent)
      while (whenStack.length > 0 && indent <= whenStack[whenStack.length - 1].indent) {
        whenStack.pop();
      }

      // Scene header - reset when stack
      if (line.startsWith('@')) {
        if (currentScene) result.push(currentScene);
        currentScene = {
          name: line.slice(1),
          lineIdx: i,
          choices: [],
        };
        whenStack.length = 0;
        continue;
      }

      // when [var] or when [!var] - push to stack
      const whenMatch = line.match(/^when\s+\[([^\]]+)\]\s*$/);
      if (whenMatch) {
        whenStack.push({ indent, condition: whenMatch[1].trim() });
        continue;
      }

      // if [var] (conditional block, not choice) - push to stack
      const ifCondMatch = line.match(/^if\s+\[([^\]]+)\]\s*$/);
      if (ifCondMatch) {
        whenStack.push({ indent, condition: ifCondMatch[1].trim() });
        continue;
      }

      // Choice line
      if (line.startsWith('if ') && currentScene) {
        let content = line.slice(3).trim();
        let requires: string | undefined;

        // Inherit condition from parent when block
        if (whenStack.length > 0) {
          requires = whenStack[whenStack.length - 1].condition;
        }

        // Check for requires at start: if [variable] Choice text
        const prefixMatch = content.match(/^\[([^\]]+)\]\s*/);
        if (prefixMatch) {
          requires = prefixMatch[1].trim();
          content = content.slice(prefixMatch[0].length);
        }

        // Check for arrow syntax: -> ?key +key -key
        const arrowIdx = content.indexOf('->');
        if (arrowIdx !== -1) {
          const effectsPart = content.slice(arrowIdx + 2).trim();
          content = content.slice(0, arrowIdx).trim();
          // Parse ?key for requires
          const effects = effectsPart.split(/\s+/);
          for (const effect of effects) {
            if (effect.startsWith('?')) {
              requires = effect.slice(1);
            }
          }
        }

        // Legacy: Check for requires at end: ... & [variable]
        const suffixMatch = content.match(/&\s*\[([^\]]+)\]\s*$/);
        if (suffixMatch) {
          requires = suffixMatch[1].trim();
          content = content.slice(0, content.lastIndexOf('&')).trim();
        }

        // Look ahead for [requires: value] metadata on following lines
        for (let j = i + 1; j < script.length; j++) {
          const nextLine = script[j].trim();
          if (!nextLine) continue;
          // Stop if we hit another choice or scene
          if (
            nextLine.startsWith('if ') ||
            nextLine.startsWith('@') ||
            nextLine.startsWith('when ')
          )
            break;
          // Check for requires metadata
          const reqMatch = nextLine.match(/^\[requires:\s*([^\]]+)\]$/);
          if (reqMatch) {
            requires = reqMatch[1].trim();
            break;
          }
        }

        // Extract choice text (before any | aliases)
        const choiceText = content.split('|')[0].trim();
        currentScene.choices.push({ text: choiceText, lineIdx: i, requires });
      }
    }

    if (currentScene) result.push(currentScene);
    return result;
  }, [script]);

  const toggleScene = (lineIdx: number) => {
    setCollapsed((prev) => ({ ...prev, [lineIdx]: !prev[lineIdx] }));
  };

  return (
    <div className="flex flex-col gap-2">
      {allVariables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <p>toggle: </p>
          {allVariables.map((v) => (
            <button
              key={v}
              onClick={() => toggleVariable(v)}
              className={twMerge(hasVariable(v) ? 'bg-green-500/30' : 'bg-neutral-100 opacity-50')}
            >
              [{v}]
            </button>
          ))}
        </div>
      )}
      {scenes.map((scene) => (
        <div key={scene.lineIdx}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleScene(scene.lineIdx)}
              className={twMerge(
                'transition-transform',
                collapsed[scene.lineIdx] ? '' : 'rotate-90',
              )}
            >
              <ChevronRightIcon className="w-4 h-4 opacity-50" />
            </button>
            <button onClick={() => replay(scene.lineIdx)} className="group flex items-center gap-1">
              {scene.name}
              <ChevronRightIcon className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </button>
            {scene.choices.length > 0 && (
              <span className="opacity-50 ml-auto">{scene.choices.length}</span>
            )}
          </div>

          {!collapsed[scene.lineIdx] && scene.choices.length > 0 && (
            <div className="ml-5 flex flex-col gap-0.5">
              {scene.choices.map((choice) => {
                const requiresSatisfied =
                  !choice.requires ||
                  (choice.requires.startsWith('!')
                    ? !hasVariable(choice.requires.slice(1))
                    : hasVariable(choice.requires));
                return (
                  <button
                    key={choice.lineIdx}
                    className={twMerge(
                      'flex items-center justify-between group',
                      !requiresSatisfied && 'opacity-30 cursor-not-allowed',
                    )}
                    onClick={() => requiresSatisfied && replay(choice.lineIdx, choice.text, true)}
                    disabled={!requiresSatisfied}
                  >
                    <span className="opacity-70 truncate">{choice.text}</span>
                    {choice.requires && (
                      <span className={twMerge('truncate opacity-50')}>[{choice.requires}]</span>
                    )}
                    <ChevronRightIcon className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
