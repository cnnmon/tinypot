import { EntryType, NarrativeEntry, OptionEntry, Schema } from '@/types/schema';
import { getScanStart } from './getScanStart';

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
    if (optionKeywords.has(keyword)) {
      matches++;
    }
  }
  return matches;
}

/**
 * Get available options at the current position in the scene
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

  for (let i = scanStart; i < schema.length; i++) {
    const entry = schema[i];

    if (entry.type === EntryType.SCENE) break;

    if (entry.type === EntryType.NARRATIVE) {
      narrativeCount++;
    } else if (entry.type === EntryType.OPTION) {
      // Options after the current lineIdx are available
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

  return options;
}

/**
 * Find the best matching option for the given input using fuzzy keyword matching
 */
export function matchOption(input: string, options: OptionEntry[]): OptionEntry | null {
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];

  let bestMatch: OptionEntry | null = null;
  let bestScore = 0;

  for (const option of options) {
    const score = countMatchingKeywords(input, option.text);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = option;
    }
  }

  // If no keywords matched, return null
  return bestMatch;
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

export interface HandleInputResult {
  matched: boolean;
  sceneId?: string;
  lineIdx?: number;
  optionText?: string;
  narratives?: NarrativeEntry[];
}

/**
 * Handle player input by matching it to available options
 * and determining the next scene/line position
 */
export function handleInput({
  input,
  schema,
  sceneMap,
  sceneId,
  lineIdx,
}: {
  input: string;
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
  lineIdx: number;
}): HandleInputResult {
  const options = getOptionsAtPosition({ schema, sceneMap, sceneId, lineIdx });

  if (options.length === 0) {
    return { matched: false };
  }

  const matchedOption = matchOption(input, options);

  if (!matchedOption) {
    return { matched: false };
  }

  const { narratives, target } = processOptionThen(matchedOption);

  if (target === 'END') {
    return {
      matched: true,
      sceneId: 'END',
      lineIdx: 0,
      optionText: matchedOption.text,
      narratives,
    };
  }

  if (target) {
    return {
      matched: true,
      sceneId: target,
      lineIdx: 0,
      optionText: matchedOption.text,
      narratives,
    };
  }

  // Option matched but no jump - continue in current scene after option content
  return {
    matched: true,
    sceneId,
    lineIdx,
    optionText: matchedOption.text,
    narratives,
  };
}
