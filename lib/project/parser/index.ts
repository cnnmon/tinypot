import { EntryType, Schema, SchemaEntry } from '@/types/schema';

/**
 * Parser for the game script format:
 * - `#` Scene marker (e.g., "# FIRE")
 * - `>` Jump/goto (e.g., "> FIRE" or "> END")
 * - `~` Option (e.g., "~ Ride a bike")
 * - Indented entries after ~ are the "then" block for that option
 * - Regular text is narrative
 */

function getIndentLevel(entry: string): number {
  const match = entry.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function stripPrefix(entry: string, prefix: string): string {
  return entry.slice(entry.indexOf(prefix) + prefix.length).trim();
}

export function parseIntoSchema(entries: string[]): Schema {
  const schema: Schema = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i];
    const trimmed = entry.trim();

    // Skip empty entries
    if (!trimmed) {
      i++;
      continue;
    }

    // Scene marker: # SCENE_NAME
    if (trimmed.startsWith('#')) {
      schema.push({
        type: EntryType.SCENE,
        label: stripPrefix(trimmed, '#'),
      });
      i++;
      continue;
    }

    // Jump/goto: > TARGET or > END
    if (trimmed.startsWith('>')) {
      schema.push({
        type: EntryType.JUMP,
        target: stripPrefix(trimmed, '>'),
      });
      i++;
      continue;
    }

    // Option: ~ Option text
    if (trimmed.startsWith('~')) {
      const optionIndent = getIndentLevel(entry);
      const optionText = stripPrefix(trimmed, '~');
      const thenBlock: SchemaEntry[] = [];

      // Collect indented entries that follow this option
      i++;
      while (i < entries.length) {
        const nextEntry = entries[i];
        const nextTrimmed = nextEntry.trim();

        // Empty entries within a then block are skipped but don't end the block
        if (!nextTrimmed) {
          i++;
          continue;
        }

        const nextIndent = getIndentLevel(nextEntry);

        // If next entry is more indented than the option, it's part of the then block
        if (nextIndent > optionIndent) {
          // Parse this entry recursively
          const [parsedEntry] = parseIntoSchema([nextTrimmed]);
          if (parsedEntry) {
            thenBlock.push(parsedEntry);
          }
          i++;
        } else {
          // Less or equal indentation means we're done with this option's then block
          break;
        }
      }

      schema.push({
        type: EntryType.OPTION,
        text: optionText,
        then: thenBlock,
      });
      continue;
    }

    // Default: narrative text
    schema.push({
      type: EntryType.NARRATIVE,
      text: trimmed,
    });
    i++;
  }

  return schema;
}
