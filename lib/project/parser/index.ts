import { LineType, Schema, SchemaLine } from '@/types/schema';

/**
 * Parser for the game script format:
 * - `#` Scene marker (e.g., "# FIRE")
 * - `>` Jump/goto (e.g., "> FIRE" or "> END")
 * - `~` Option (e.g., "~ Ride a bike")
 * - Indented lines after ~ are the "then" block for that option
 * - Regular text is narrative
 */

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function stripPrefix(line: string, prefix: string): string {
  return line.slice(line.indexOf(prefix) + prefix.length).trim();
}

export function parseIntoSchema(plainLines: string[]): Schema {
  const schema: Schema = [];
  let i = 0;

  while (i < plainLines.length) {
    const line = plainLines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Scene marker: # SCENE_NAME
    if (trimmed.startsWith('#')) {
      schema.push({
        type: LineType.SCENE,
        label: stripPrefix(trimmed, '#'),
      });
      i++;
      continue;
    }

    // Jump/goto: > TARGET or > END
    if (trimmed.startsWith('>')) {
      schema.push({
        type: LineType.JUMP,
        target: stripPrefix(trimmed, '>'),
      });
      i++;
      continue;
    }

    // Option: ~ Option text
    if (trimmed.startsWith('~')) {
      const optionIndent = getIndentLevel(line);
      const optionText = stripPrefix(trimmed, '~');
      const thenBlock: SchemaLine[] = [];

      // Collect indented lines that follow this option
      i++;
      while (i < plainLines.length) {
        const nextLine = plainLines[i];
        const nextTrimmed = nextLine.trim();

        // Empty lines within a then block are skipped but don't end the block
        if (!nextTrimmed) {
          i++;
          continue;
        }

        const nextIndent = getIndentLevel(nextLine);

        // If next line is more indented than the option, it's part of the then block
        if (nextIndent > optionIndent) {
          // Parse this line recursively
          const [parsedLine] = parseIntoSchema([nextTrimmed]);
          if (parsedLine) {
            thenBlock.push(parsedLine);
          }
          i++;
        } else {
          // Less or equal indentation means we're done with this option's then block
          break;
        }
      }

      schema.push({
        type: LineType.OPTION,
        text: optionText,
        then: thenBlock,
      });
      continue;
    }

    // Default: narrative text
    schema.push({
      type: LineType.NARRATIVE,
      text: trimmed,
    });
    i++;
  }

  return schema;
}
