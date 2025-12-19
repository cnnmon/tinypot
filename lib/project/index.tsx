'use client';

/**
 * Project context - manages the editor (schema) and game (playthrough) state.
 * Provides the bridge between authoring and playing an interactive narrative.
 */

import {
  createInitialGameState,
  jumpBackToChoice,
  markHistoryAnimated,
  refreshGameOptions,
  selectGameOption,
} from '@/lib/game';
import { parseIntoSchema } from '@/lib/project/parser';
import { Game, GameState } from '@/types/games';
import { Playthrough } from '@/types/playthroughs';
import { OptionLine, Schema } from '@/types/schema';
import { Branch } from '@/types/versions';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createBranch, getOrCreateGame, updateGame } from '../db';
import { buildSceneMap, SceneMap } from '../game/utils';
import { schemasEqual } from './brancher';
import { getChangedLineNumbers } from './differ';

interface ProjectContextValue {
  game: Game;

  // Editor state
  lines: string[];
  editLines: (newLines: string[]) => void;
  schema: Schema;

  // Game/playthrough state
  gameState: GameState;
  selectOption: (option: OptionLine) => void;
  jumpToChoice: (historyIndex: number) => void;
  fullRestart: () => void;
  onAnimationComplete: () => void;

  // Branch viewing
  viewingBranch: Branch | null;
  setViewingBranch: (branch: Branch | null) => void;
  changedLines: Set<number>;

  // Branch creation
  createBranchFromPlaythrough: () => Promise<Branch | null>;

  // Playthrough metadata
  playthrough: Playthrough | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const DEFAULT_LINES = [
  'Can you believe it?',
  '> FIRE',
  '# FIRE',
  'The fire burns brightly.',
  '~ Ride a bike',
  "   That's cool!",
  '   > BIKE',
  '~ Run away',
  '   Weirdo…',
  '# BIKE',
  'Learn to sail',
  '> END',
];

export function ProjectProvider({
  children,
  projectId,
}: {
  children: ReactNode;
  projectId: string;
}) {
  const [game, setGame] = useState<Game | null>(null);
  const [lines, setLines] = useState<string[]>(DEFAULT_LINES);
  const [schema, setSchema] = useState<Schema>(() => parseIntoSchema(DEFAULT_LINES));

  // Track the base schema when playthrough started (for branch diffs)
  const baseSchemaRef = useRef<Schema>(schema);

  // Derived scene map for efficient lookups
  const sceneMap: SceneMap = useMemo(() => buildSceneMap(schema), [schema]);

  // Game state - initialized from current schema
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(parseIntoSchema(DEFAULT_LINES))
  );

  // Playthrough metadata (for persistence)
  const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);

  // Branch viewing state
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);

  // Compute changed lines when viewing a branch
  const changedLines = useMemo(() => {
    if (!viewingBranch || !game) return new Set<number>();
    // Compare current lines against the branch's base (main schema)
    // When viewing a branch, highlight what's different from main
    const mainLines = game.lines;
    return getChangedLineNumbers(mainLines, lines);
  }, [viewingBranch, game, lines]);

  // Load or create game from DB
  useEffect(() => {
    const initialSchema = parseIntoSchema(DEFAULT_LINES);
    getOrCreateGame(projectId, {
      name: 'New Project',
      description: '',
      authorId: 'local',
      lines: DEFAULT_LINES,
      schema: initialSchema,
    }).then((loadedGame) => {
      setGame(loadedGame);
      // Restore saved lines and schema if they exist
      if (loadedGame.lines && loadedGame.lines.length > 0) {
        setLines(loadedGame.lines);
        setSchema(loadedGame.schema);
        baseSchemaRef.current = loadedGame.schema;
        setGameState(createInitialGameState(loadedGame.schema));
      }
    });
  }, [projectId]);

  // Initialize playthrough metadata when game loads
  useEffect(() => {
    if (game && !playthrough) {
      setPlaythrough({
        id: crypto.randomUUID(),
        gameId: game.id,
        currentLineIdx: gameState.currentLineIdx,
        history: gameState.history,
        createdAt: new Date().toISOString(),
      });
    }
  }, [game, playthrough, gameState]);

  // Sync playthrough metadata when gameState changes
  useEffect(() => {
    if (playthrough) {
      setPlaythrough((prev) =>
        prev
          ? {
              ...prev,
              currentLineIdx: gameState.currentLineIdx,
              history: gameState.history,
            }
          : null
      );
    }
  }, [gameState.currentLineIdx, gameState.history]);

  // Update schema when lines change - game restarts with new schema
  const editLines = useCallback(
    (newLines: string[]) => {
      const newSchema = parseIntoSchema(newLines);
      setLines(newLines);
      setSchema(newSchema);

      // Refresh options at current position (keep history and line index stable)
      setGameState((prev) => refreshGameOptions(newSchema, prev));

      // Auto-save both lines and schema to DB
      if (game) {
        updateGame(game.id, { lines: newLines, schema: newSchema });
      }
    },
    [game]
  );

  // Handle option selection
  const selectOption = useCallback(
    (option: OptionLine) => {
      setGameState((prev) => selectGameOption(schema, sceneMap, prev, option));
    },
    [schema, sceneMap]
  );

  // Jump back to a specific choice in history
  const jumpToChoice = useCallback(
    (historyIndex: number) => {
      setGameState((prev) => jumpBackToChoice(schema, prev, historyIndex));
    },
    [schema]
  );

  // Full restart - starts from the very beginning
  const fullRestart = useCallback(() => {
    const newState = createInitialGameState(schema);
    setGameState(newState);
    baseSchemaRef.current = schema;

    if (game) {
      setPlaythrough({
        id: crypto.randomUUID(),
        gameId: game.id,
        currentLineIdx: newState.currentLineIdx,
        history: newState.history,
        createdAt: new Date().toISOString(),
      });
    }
  }, [schema, game]);

  // Mark history as fully animated (called by History component)
  const onAnimationComplete = useCallback(() => {
    setGameState((prev) => markHistoryAnimated(prev));
  }, []);

  // Create a branch from the current playthrough (diff from base schema)
  const createBranchFromPlaythrough = useCallback(async (): Promise<Branch | null> => {
    if (!playthrough || !game) return null;

    const baseSchema = baseSchemaRef.current;
    if (schemasEqual(baseSchema, schema)) {
      return null; // No changes
    }

    const branch = await createBranch(baseSchema, schema);

    // Update playthrough with branch reference
    setPlaythrough((prev) =>
      prev ? { ...prev, branchId: [...(prev.branchId || []), branch.id] } : null
    );

    // Update game with new branch
    setGame((prev) => (prev ? { ...prev, branches: [...prev.branches, branch] } : null));
    if (game) {
      await updateGame(game.id, { branches: [...game.branches, branch] });
    }

    return branch;
  }, [playthrough, game, schema]);

  if (!game) {
    return null;
  }

  return (
    <ProjectContext.Provider
      value={{
        game,
        lines,
        editLines,
        schema,
        gameState,
        selectOption,
        jumpToChoice,
        fullRestart,
        onAnimationComplete,
        viewingBranch,
        setViewingBranch,
        changedLines,
        createBranchFromPlaythrough,
        playthrough,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
