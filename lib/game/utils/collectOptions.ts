import { LineType, OptionLine, Schema } from '@/types/schema';

/** Collects consecutive options starting at idx */
export function collectOptions(schema: Schema, startIdx: number): OptionLine[] {
  const options: OptionLine[] = [];
  let idx = startIdx;
  while (idx < schema.length && schema[idx].type === LineType.OPTION) {
    options.push(schema[idx] as OptionLine);
    idx++;
  }
  return options;
}
