/**
 * Parses editor plaintext into a schema.
 */

import { Schema } from '@/types/schema';
import { useState } from 'react';

export interface ParserOutput {
  lines: string[];
  editLines: (lines: string[]) => void;
  schema: Schema;
}

function parseIntoSchema(plainLines: string[]): Schema {
  const schema: Schema = [];

  for (const line in plainLines) {
    console.log(line);
  }

  return schema;
}

export function useParser({ initialSchema }: { initialSchema: Schema }): ParserOutput {
  const [lines, setLines] = useState(['The fire burns brightly.', 'goto FIRE']);
  const [schema, setSchema] = useState<Schema>(initialSchema);

  function editLines(newLines: string[]) {
    const newSchema = parseIntoSchema(newLines);
    setLines(newLines);
    setSchema(newSchema);
  }

  return { lines, editLines, schema };
}
