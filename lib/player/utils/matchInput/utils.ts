import {
  AllowsConfig,
  ConditionalEntry,
  EntryType,
  MetadataEntry,
  NarrativeEntry,
  OptionEntry,
  parseAllows,
  Schema,
  SchemaEntry,
} from '@/types/schema';
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
  // Check for exact option text match first
  if (option.text.toLowerCase() === input.toLowerCase()) {
    return { score: 10 }; // High score for exact text match
  }

  let bestScore = countMatchingKeywords(input, option.text);
  let matchedAlias: string | undefined;

  if (option.aliases) {
    for (const alias of option.aliases) {
      if (alias.toLowerCase() === input.toLowerCase()) {
        return { score: 10, matchedAlias: alias };
      }

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
 * 3. Their requires condition is met (if hasVariable is provided)
 */
export function getOptionsAtPosition({
  schema,
  sceneMap,
  sceneId,
  lineIdx,
  hasVariable,
}: {
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
  lineIdx: number;
  hasVariable?: (variable: string) => boolean;
}): OptionEntry[] {
  const sceneStart = sceneMap[sceneId];
  if (sceneStart === undefined) return [];
  const scanStart = getScanStart(schema, sceneStart);

  // Count positions (narrative + image + metadata entries) to match step.ts behavior
  let positionCount = 0;
  const options: OptionEntry[] = [];
  const allSceneOptions: OptionEntry[] = [];

  // Helper to check if an option's requires condition is met
  const meetsRequiresCondition = (opt: OptionEntry): boolean => {
    if (!opt.requires || !hasVariable) return true;
    if (opt.requires.startsWith('!')) {
      return !hasVariable(opt.requires.slice(1));
    }
    return hasVariable(opt.requires);
  };

  // Recursively process entries to find options (handles conditionals)
  const processEntries = (entries: SchemaEntry[]): boolean => {
    for (const entry of entries) {
      if (entry.type === EntryType.SCENE) return true; // Stop at scene boundary

      if (entry.type === EntryType.NARRATIVE || entry.type === EntryType.IMAGE) {
        positionCount++;
      } else if (entry.type === EntryType.METADATA) {
        const meta = entry as MetadataEntry;
        if (meta.key === 'sets' || meta.key === 'unsets') {
          positionCount++;
        }
      } else if (entry.type === EntryType.CONDITIONAL) {
        // Evaluate conditional and process the appropriate branch
        const conditional = entry as ConditionalEntry;
        const conditionMet = evaluateCondition(conditional.condition, hasVariable);
        const branchEntries = conditionMet ? conditional.then : conditional.else;
        if (branchEntries) {
          const shouldStop = processEntries(branchEntries);
          if (shouldStop) return true;
        }
      } else if (entry.type === EntryType.OPTION) {
        const opt = entry as OptionEntry;
        if (meetsRequiresCondition(opt)) {
          allSceneOptions.push(opt);
          if (positionCount >= lineIdx) {
            options.push(opt);
          }
        }
      } else if (entry.type === EntryType.JUMP) {
        if (positionCount >= lineIdx && options.length === 0) {
          return true; // Stop if we hit a jump before finding options
        }
      }
    }
    return false;
  };

  const entriesToProcess = schema.slice(scanStart);
  processEntries(entriesToProcess);

  // If lineIdx is past all content (end of scene), return all scene options (implicit loop)
  if (options.length === 0 && lineIdx > positionCount && allSceneOptions.length > 0) {
    return allSceneOptions;
  }

  return options;
}

/**
 * Get the allows configuration for the current scene.
 * Returns the most recent [allows: ...] metadata in the scene.
 */
export function getAllowsForScene({
  schema,
  sceneMap,
  sceneId,
}: {
  schema: Schema;
  sceneMap: Record<string, number>;
  sceneId: string;
}): AllowsConfig {
  const sceneStart = sceneMap[sceneId];
  if (sceneStart === undefined) return parseAllows(undefined);
  const scanStart = getScanStart(schema, sceneStart);

  let allowsValue: string | undefined;

  for (let i = scanStart; i < schema.length; i++) {
    const entry = schema[i];
    if (entry.type === EntryType.SCENE) break;

    if (entry.type === EntryType.METADATA) {
      const meta = entry as MetadataEntry;
      if (meta.key === 'allows') {
        allowsValue = meta.value;
      }
    }
  }

  return parseAllows(allowsValue);
}

/**
 * Find the best matching option for the given input using keyword matching (including aliases)
 */
export function matchOption(input: string, options: OptionEntry[]): MatchOptionResult | null {
  if (options.length === 0) return null;

  let bestMatch: OptionEntry | null = null;
  let bestScore = 0;
  let bestMatchedAlias: string | undefined;

  for (const option of options) {
    const { score, matchedAlias } = countMatchingKeywordsWithAliases(input, option);
    if (score > 5 && score > bestScore) {
      bestScore = score;
      bestMatch = option;
      bestMatchedAlias = matchedAlias;
    }
  }

  // If no keywords matched, return null (will fall back to fuzzy matching or generation)
  if (!bestMatch || bestScore === 0) return null;
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
export async function matchOptionFuzzy(input: string, options: OptionEntry[]): Promise<FuzzyMatchResult> {
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
 * Evaluate a condition string against current variables.
 * Supports negation with ! prefix.
 */
function evaluateCondition(condition: string, hasVariable?: (variable: string) => boolean): boolean {
  if (!hasVariable) return true;
  const trimmed = condition.trim();
  if (trimmed.startsWith('!')) {
    return !hasVariable(trimmed.slice(1).trim());
  }
  return hasVariable(trimmed);
}

/**
 * Process schema entries to extract narratives, metadata, and find the target scene.
 * Evaluates conditional entries based on current variables.
 * Stops processing when a jump/goto is encountered.
 */
function processEntries(
  entries: SchemaEntry[],
  hasVariable?: (variable: string) => boolean,
): {
  narratives: NarrativeEntry[];
  metadata: MetadataEntry[];
  target: string | null;
} {
  const narratives: NarrativeEntry[] = [];
  const metadata: MetadataEntry[] = [];
  let target: string | null = null;

  for (const entry of entries) {
    if (entry.type === EntryType.NARRATIVE) {
      narratives.push(entry);
    } else if (entry.type === EntryType.METADATA) {
      const meta = entry as MetadataEntry;
      // Only collect sets/unsets metadata
      if (meta.key === 'sets' || meta.key === 'unsets') {
        metadata.push(meta);
      }
    } else if (entry.type === EntryType.JUMP) {
      target = entry.target.trim();
      // Stop processing after a jump - don't include narratives after goto
      break;
    } else if (entry.type === EntryType.CONDITIONAL) {
      const conditional = entry as ConditionalEntry;
      const conditionMet = evaluateCondition(conditional.condition, hasVariable);
      const branchEntries = conditionMet ? conditional.then : conditional.else;

      if (branchEntries) {
        const branchResult = processEntries(branchEntries, hasVariable);
        narratives.push(...branchResult.narratives);
        metadata.push(...branchResult.metadata);
        if (branchResult.target) {
          target = branchResult.target;
          // Stop processing after a conditional that contains a jump
          break;
        }
      }
    }
  }

  return { narratives, metadata, target };
}

/**
 * Process an option's `then` entries to extract narratives, metadata, and find the target scene
 */
function processOptionThen(
  option: OptionEntry,
  hasVariable?: (variable: string) => boolean,
): {
  narratives: NarrativeEntry[];
  metadata: MetadataEntry[];
  target: string | null;
} {
  return processEntries(option.then, hasVariable);
}

/**
 * Build result from matched option
 */
export function buildResultFromOption(
  option: OptionEntry,
  sceneId: string,
  lineIdx: number,
  matchInfo?: MatchInfo,
  hasVariable?: (variable: string) => boolean,
): HandleInputResult {
  const { narratives, metadata, target } = processOptionThen(option, hasVariable);

  const base = {
    matched: true,
    optionText: option.text,
    narratives,
    metadata,
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
