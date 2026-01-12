import { MetadataEntry, NarrativeEntry, OptionEntry } from '@/types/schema';

export interface MatchInfo {
  fuzzyMatch?: { confidence: number; suggestedAlias: string };
  cachedMatch?: { matchedAlias: string };
}

export interface MatchOptionResult {
  option: OptionEntry;
  matchedAlias?: string; // The cached alias that matched, if any
}

export interface HandleInputResult {
  matched: boolean;
  sceneId?: string;
  lineIdx?: number;
  optionText?: string;
  narratives?: NarrativeEntry[];
  metadata?: MetadataEntry[];
  // Fuzzy match info (when AI matching was used)
  fuzzyMatch?: {
    confidence: number;
    suggestedAlias: string;
  };
  // Cached match info (when matched via a saved alias)
  cachedMatch?: {
    matchedAlias: string;
  };
}
