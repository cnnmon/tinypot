'use client';

import { useCallback, useState } from 'react';

export interface VariablesState {
  variables: Map<string, number>;
  /** Check if variable exists (count >= 1), or compare with threshold: has('gold', 5) checks gold >= 5 */
  has: (variable: string, threshold?: number) => boolean;
  /** Get the count of a variable (0 if not set) */
  get: (variable: string) => number;
  /** Increment variable by 1 (or set to 1 if not exists) */
  set: (variable: string) => void;
  /** Decrement variable by 1 (removes if goes to 0) */
  unset: (variable: string) => void;
  reset: () => void;
  /** Get all variables as formatted strings: "var" if count=1, "var (N)" if count > 1 */
  getAll: () => string[];
  /** Get raw map of variable names to counts */
  getAllRaw: () => Record<string, number>;
}

/**
 * Hook for tracking numeric variables during gameplay.
 * Variables are counters: +var increments, -var decrements.
 * Display: "var" when count=1, "var (N)" when count > 1.
 * Conditions: `when var` (>= 1), `when var >= N` (>= N).
 */
export function useVariables(): VariablesState {
  const [variables, setVariables] = useState<Map<string, number>>(new Map());

  const normalize = (variable: string) => variable.trim().toLowerCase();

  const has = useCallback(
    (variable: string, threshold = 1) => {
      const count = variables.get(normalize(variable)) ?? 0;
      return count >= threshold;
    },
    [variables],
  );

  const get = useCallback(
    (variable: string) => {
      return variables.get(normalize(variable)) ?? 0;
    },
    [variables],
  );

  const set = useCallback((variable: string) => {
    setVariables((prev) => {
      const next = new Map(prev);
      const key = normalize(variable);
      const current = next.get(key) ?? 0;
      next.set(key, current + 1);
      return next;
    });
  }, []);

  const unset = useCallback((variable: string) => {
    setVariables((prev) => {
      const next = new Map(prev);
      const key = normalize(variable);
      const current = next.get(key) ?? 0;
      if (current <= 1) {
        next.delete(key);
      } else {
        next.set(key, current - 1);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setVariables(new Map());
  }, []);

  const getAll = useCallback(() => {
    return Array.from(variables.entries()).map(([key, count]) => 
      `${key} (${count})`
    );
  }, [variables]);

  const getAllRaw = useCallback(() => {
    return Object.fromEntries(variables.entries());
  }, [variables]);

  return {
    variables,
    has,
    get,
    set,
    unset,
    reset,
    getAll,
    getAllRaw,
  };
}
