'use client';

import { useCallback, useState } from 'react';

export interface VariablesState {
  variables: Set<string>;
  has: (variable: string) => boolean;
  set: (variable: string) => void;
  unset: (variable: string) => void;
  reset: () => void;
  getAll: () => string[];
}

/**
 * Hook for tracking variables during gameplay.
 * Variables are set/unset based on [sets: var] and [unsets: var] metadata.
 * Conditions like [requires: var] or if [var] check against this state.
 */
export function useVariables(): VariablesState {
  const [variables, setVariables] = useState<Set<string>>(new Set());

  const has = useCallback(
    (variable: string) => {
      return variables.has(variable.trim().toLowerCase());
    },
    [variables],
  );

  const set = useCallback((variable: string) => {
    setVariables((prev) => {
      const next = new Set(prev);
      next.add(variable.trim().toLowerCase());
      return next;
    });
  }, []);

  const unset = useCallback((variable: string) => {
    setVariables((prev) => {
      const next = new Set(prev);
      next.delete(variable.trim().toLowerCase());
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setVariables(new Set());
  }, []);

  const getAll = useCallback(() => {
    return Array.from(variables);
  }, [variables]);

  return {
    variables,
    has,
    set,
    unset,
    reset,
    getAll,
  };
}

