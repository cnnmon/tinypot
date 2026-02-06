import { Schema } from '@/types/schema';
import { HandleInputResult, MatchInfo } from './types';
import { buildResultFromOption, getOptionsAtPosition, matchOption, matchOptionFuzzy } from './utils';

/**
 * Handle player input by matching it to available options
 * and determining the next scene/line position.
 * Uses keyword matching first, then falls back to AI fuzzy matching.
 */
export async function matchInput({
  input,
  schema,
  sceneMap,
  sceneId,
  lineIdx,
  useFuzzyFallback = true,
  hasVariable,
  getVariable,
}: {
  input: string;
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
  lineIdx: number;
  useFuzzyFallback?: boolean;
  hasVariable?: (variable: string, threshold?: number) => boolean;
  getVariable?: (variable: string) => number;
}): Promise<HandleInputResult> {
  const options = getOptionsAtPosition({ schema, sceneMap, sceneId, lineIdx, hasVariable, getVariable });

  if (options.length === 0) {
    return { matched: false };
  }

  // Try keyword matching first (including aliases)
  const matchResult = matchOption(input, options);

  if (matchResult) {
    const matchInfo: MatchInfo | undefined = matchResult.matchedAlias
      ? { cachedMatch: { matchedAlias: matchResult.matchedAlias } }
      : undefined;
    return buildResultFromOption(matchResult.option, sceneId, lineIdx, matchInfo, hasVariable, getVariable);
  }

  // Fallback to AI fuzzy matching
  if (useFuzzyFallback) {
    const fuzzyResult = await matchOptionFuzzy(input, options);

    if (fuzzyResult.matched && fuzzyResult.optionIndex !== null) {
      const fuzzyMatchedOption = options[fuzzyResult.optionIndex];
      return buildResultFromOption(
        fuzzyMatchedOption,
        sceneId,
        lineIdx,
        {
          fuzzyMatch: {
            confidence: fuzzyResult.confidence,
            suggestedAlias: input, // Use original input as alias, not the AI's normalized version
          },
        },
        hasVariable,
        getVariable,
      );
    }
  }

  return { matched: false };
}
