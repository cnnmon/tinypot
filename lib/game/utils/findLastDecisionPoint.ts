import { LineType, Schema } from '@/types/schema';

export function findLastDecisionPoint(schema: Schema, beforeIdx: number): number {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (schema[i].type === LineType.OPTION) {
      // Walk back to find start of this option group
      let start = i;
      while (start > 0 && schema[start - 1].type === LineType.OPTION) {
        start--;
      }
      return start;
    }
  }
  return 0; // fallback to start
}
