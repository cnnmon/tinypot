export interface MatchInfo {
  fuzzyMatch?: { confidence: number; suggestedAlias: string };
  cachedMatch?: { matchedAlias: string };
}
