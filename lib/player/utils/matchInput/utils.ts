import { EntryType, NarrativeEntry, OptionEntry, Schema } from '@/types/schema';
import { getScanStart } from '../getScanStart';
import { HandleInputResult, MatchInfo, MatchOptionResult } from './types';

/**
 * Extract keywords from text (lowercase, split by whitespace/punctuation)
 */
function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,.!?;:'"()-]+/)
      .filter((word) => word.length > 0),
  );
}

/**
 * Count matching keywords between two texts
 */
function countMatchingKeywords(input: string, optionText: string): number {
  const inputKeywords = extractKeywords(input);
  const optionKeywords = extractKeywords(optionText);

  let matches = 0;
  for (const keyword of inputKeywords) {
    if (keyword.length < 3) continue;

    if (optionKeywords.has(keyword)) {
      matches++;
    }
  }
  return matches;
}

/**
 * Count matching keywords for an option including its aliases
 * Returns the best score and which alias matched (if any)
 */
function countMatchingKeywordsWithAliases(
  input: string,
  option: OptionEntry,
): {
  score: number;
  matchedAlias?: string; // The alias that matched, if any
} {
  let bestScore = countMatchingKeywords(input, option.text);
  let matchedAlias: string | undefined;

  if (option.aliases) {
    for (const alias of option.aliases) {
      const aliasScore = countMatchingKeywords(input, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        matchedAlias = alias;
      }
    }
  }

  return { score: bestScore, matchedAlias };
}

/**
 * Get available options at the current position in the scene.
 *
 * Options are available when:
 * 1. They appear after the current narrative position (immediate decision point)
 * 2. The player is at the end of the scene (implicit loop back to all scene options)
 */
export function getOptionsAtPosition({
  schema,
  sceneMap,
  sceneId,
  lineIdx,
}: {
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
  lineIdx: number;
}): OptionEntry[] {
  const sceneStart = sceneMap[sceneId];
  if (sceneStart === undefined) return [];
  const scanStart = getScanStart(schema, sceneStart);

  let narrativeCount = 0;
  const options: OptionEntry[] = [];
  const allSceneOptions: OptionEntry[] = [];

  for (let i = scanStart; i < schema.length; i++) {
    const entry = schema[i];

    if (entry.type === EntryType.SCENE) break;

    if (entry.type === EntryType.NARRATIVE) {
      narrativeCount++;
    } else if (entry.type === EntryType.OPTION) {
      // Collect all options in the scene for potential implicit loop
      allSceneOptions.push(entry);
      // Options after the current lineIdx are immediately available
      if (narrativeCount >= lineIdx) {
        options.push(entry);
      }
    } else if (entry.type === EntryType.JUMP) {
      // Stop collecting options if we hit a jump before options
      if (narrativeCount >= lineIdx && options.length === 0) {
        break;
      }
    }
  }

  // If lineIdx is past all narratives (end of scene), return all scene options (implicit loop)
  if (options.length === 0 && lineIdx > narrativeCount && allSceneOptions.length > 0) {
    return allSceneOptions;
  }

  return options;
}

/**
 * Find the best matching option for the given input using keyword matching (including aliases)
 */
export function matchOption(input: string, options: OptionEntry[]): MatchOptionResult | null {
  if (options.length === 0) return null;
  if (options.length === 1) return { option: options[0] };

  let bestMatch: OptionEntry | null = null;
  let bestScore = 0;
  let bestMatchedAlias: string | undefined;

  for (const option of options) {
    const { score, matchedAlias } = countMatchingKeywordsWithAliases(input, option);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = option;
      bestMatchedAlias = matchedAlias;
    }
  }

  // If no keywords matched, return null
  if (!bestMatch) return null;
  return { option: bestMatch, matchedAlias: bestMatchedAlias };
}

export interface FuzzyMatchResult {
  matched: boolean;
  optionIndex: number | null;
  confidence: number;
  suggestedAlias?: string;
}

/**
 * Use AI to match user input to options when keyword matching fails
 */
export async function matchOptionFuzzy(
  input: string,
  options: OptionEntry[],
): Promise<FuzzyMatchResult> {
  try {
    const response = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput: input,
        options: options.map((opt) => ({
          text: opt.text,
          aliases: opt.aliases,
        })),
      }),
    });

    if (!response.ok) {
      return { matched: false, optionIndex: null, confidence: 0 };
    }

    return await response.json();
  } catch {
    return { matched: false, optionIndex: null, confidence: 0 };
  }
}

/**
 * Process an option's `then` entries to extract narratives and find the target scene
 */
function processOptionThen(option: OptionEntry): {
  narratives: NarrativeEntry[];
  target: string | null;
} {
  const narratives: NarrativeEntry[] = [];
  let target: string | null = null;

  for (const entry of option.then) {
    if (entry.type === EntryType.NARRATIVE) {
      narratives.push(entry);
    } else if (entry.type === EntryType.JUMP) {
      target = entry.target.trim();
    }
  }

  return { narratives, target };
}

/**
 * Build result from matched option
 */
export function buildResultFromOption(
  option: OptionEntry,
  sceneId: string,
  lineIdx: number,
  matchInfo?: MatchInfo,
): HandleInputResult {
  const { narratives, target } = processOptionThen(option);

  const base = {
    matched: true,
    optionText: option.text,
    narratives,
    fuzzyMatch: matchInfo?.fuzzyMatch,
    cachedMatch: matchInfo?.cachedMatch,
  };

  if (target === 'END') {
    return { ...base, sceneId: 'END', lineIdx: 0 };
  }

  if (target) {
    return { ...base, sceneId: target, lineIdx: 0 };
  }

  // Option matched but no jump - continue in current scene after option content
  return { ...base, sceneId, lineIdx };
}
