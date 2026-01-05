import { EntryType, Schema, SchemaEntry } from '@/types/schema';

/**
 * Parser for the game script format:
 * - `#` Scene marker (e.g., "# FIRE")
 * - `>` Jump/goto (e.g., "> FIRE" or "> END")
 * - `*` Option (e.g., "* Ride a bike")
 * - Indented entries after * are the "then" block for that option
 * - Regular text is narrative
 */

function getIndentLevel(entry: string): number {
  const match = entry.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function stripPrefix(entry: string, prefix: string): string {
  return entry.slice(entry.indexOf(prefix) + prefix.length).trim();
}

/**
 * Parse option text that may include aliases
 * Formats:
 *   - "Ride a bike" -> { text: "Ride a bike", aliases: undefined }
 *   - "[Ride a bike, Cycle, Pedal]" -> { text: "Ride a bike", aliases: ["Cycle", "Pedal"] }
 */
function parseOptionText(optionText: string): { text: string; aliases?: string[] } {
  const trimmed = optionText.trim();
  
  // Check for bracket format: [Primary, Alias1, Alias2]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    const parts = inner.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length >= 1) {
      const [text, ...aliases] = parts;
      return {
        text,
        aliases: aliases.length > 0 ? aliases : undefined,
      };
    }
  }
  
  return { text: trimmed };
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

    // Option: * Option text or * [Option text, Alias1, Alias2]
    if (trimmed.startsWith('*')) {
      const optionIndent = getIndentLevel(entry);
      const optionRaw = stripPrefix(trimmed, '*');
      const { text: optionText, aliases } = parseOptionText(optionRaw);
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
        ...(aliases && { aliases }),
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

/**
 * Normalize text for comparison (lowercase, trim, collapse whitespace)
 */
function normalizeForComparison(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two strings are too similar to warrant adding as separate aliases.
 * Returns true if they're redundant (shouldn't add the new alias).
 */
function isRedundantAlias(existing: string, newAlias: string): boolean {
  const normExisting = normalizeForComparison(existing);
  const normNew = normalizeForComparison(newAlias);

  // Exact match after normalization
  if (normExisting === normNew) return true;

  // One contains the other (e.g., "run" vs "run away" or "running" vs "run")
  if (normExisting.includes(normNew) || normNew.includes(normExisting)) return true;

  // Check if they share the same root words (simple stemming)
  const existingWords = new Set(normExisting.split(' '));
  const newWords = normNew.split(' ');
  const sharedWords = newWords.filter((w) => existingWords.has(w));

  // If most words are shared, it's redundant
  if (sharedWords.length >= Math.max(newWords.length, existingWords.size) * 0.8) return true;

  return false;
}

/**
 * Add an alias to an option in the script lines.
 * Transforms "* Ride a bike" to "* [Ride a bike, Cycle]"
 * or "* [Ride a bike, Cycle]" to "* [Ride a bike, Cycle, Pedal]"
 * Avoids adding redundant aliases that are too similar to existing ones.
 */
export function addAliasToOption(
  lines: string[],
  optionText: string,
  newAlias: string,
): string[] {
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('*')) return line;

    const indent = line.match(/^(\s*)/)?.[1] || '';
    const optionRaw = stripPrefix(trimmed, '*');
    const { text, aliases } = parseOptionText(optionRaw);

    // Check if this is the option we're looking for
    if (text !== optionText) return line;

    // Check if alias is redundant with the option text itself
    if (isRedundantAlias(text, newAlias)) return line;

    // Check if alias is redundant with any existing alias
    if (aliases?.some((existing) => isRedundantAlias(existing, newAlias))) return line;

    // Build new option line with alias
    const allAliases = aliases ? [...aliases, newAlias] : [newAlias];
    return `${indent}* [${text}, ${allAliases.join(', ')}]`;
  });
}

/**
 * Add a player input log line after a narrative line.
 * Format: "PLAYER: <input> (matched to "<optionText>" with <confidence>% confidence)"
 */
export function addPlayerInputLog(
  lines: string[],
  sceneId: string,
  optionText: string,
  input: string,
  confidence: number,
): string[] {
  // Find the scene and the option, then add the log after relevant narrative
  let inTargetScene = false;
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    result.push(line);

    // Track scene
    if (trimmed.startsWith('#')) {
      const sceneName = stripPrefix(trimmed, '#');
      inTargetScene = sceneName === sceneId;
      continue;
    }

    // Find the matching option in the target scene
    if (inTargetScene && trimmed.startsWith('*')) {
      const optionRaw = stripPrefix(trimmed, '*');
      const { text } = parseOptionText(optionRaw);

      if (text === optionText) {
        // Add the player log after the option's then block
        const optionIndent = line.match(/^(\s*)/)?.[1] || '';
        const logIndent = optionIndent + '   ';
        const confidencePercent = Math.round(confidence * 100);
        const logLine = `${logIndent}PLAYER: ${input} (matched to "${optionText}" with ${confidencePercent}% confidence)`;

        // Find where the then block ends and insert
        let j = i + 1;
        while (j < lines.length) {
          const nextTrimmed = lines[j].trim();
          if (!nextTrimmed) {
            result.push(lines[j]);
            j++;
            continue;
          }
          const nextIndent = lines[j].match(/^(\s*)/)?.[1]?.length || 0;
          const currentIndent = optionIndent.length;
          if (nextIndent <= currentIndent) break;
          result.push(lines[j]);
          j++;
        }

        // Insert log line
        result.push(logLine);

        // Continue from where we left off
        i = j - 1;
      }
    }
  }

  return result;
}

/**
 * Add a generated option to the script at the right location.
 * Inserts after existing options in the given scene, or after the last narrative if no options exist.
 */
export function addGeneratedOptionToScript(
  lines: string[],
  sceneId: string,
  optionText: string,
  aliases: string[],
  thenLines: string[],
): string[] {
  // Resolve "START" to the actual first scene (or treat as implicit first scene)
  let targetSceneId = sceneId;
  if (sceneId === 'START') {
    // Find the first scene marker to use as target
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        targetSceneId = stripPrefix(trimmed, '#');
        break;
      }
    }
  }

  const result: string[] = [];
  let inTargetScene = false;
  let lastOptionEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track scene changes
    if (trimmed.startsWith('#')) {
      const sceneName = stripPrefix(trimmed, '#');
      inTargetScene = sceneName === targetSceneId;
      result.push(line);
      continue;
    }

    // Track last option position in target scene
    if (inTargetScene && trimmed.startsWith('*')) {
      // Find end of this option's then block
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();
        if (!nextTrimmed) {
          j++;
          continue;
        }
        const optionIndent = getIndentLevel(line);
        const nextIndent = getIndentLevel(nextLine);
        if (nextIndent <= optionIndent) break;
        j++;
      }
      // Push option and its then block
      result.push(line);
      for (let k = i + 1; k < j; k++) {
        result.push(lines[k]);
      }
      lastOptionEndIdx = result.length;
      i = j - 1;
      continue;
    }

    result.push(line);
  }

  // Build the new option block with aliases if present
  const optionLine = aliases.length > 0
    ? `* [${optionText}, ${aliases.join(', ')}]`
    : `* ${optionText}`;
  const newOptionLines: string[] = [
    optionLine,
    ...thenLines.map((l) => `   ${l}`),
  ];

  // Insert after the last option in the target scene
  if (lastOptionEndIdx !== -1) {
    result.splice(lastOptionEndIdx, 0, ...newOptionLines);
  } else {
    // No options found - find where to insert in the target scene
    // Insert before the next scene marker or at end of file
    let insertIdx = result.length;
    inTargetScene = false;
    for (let i = 0; i < result.length; i++) {
      const trimmed = result[i].trim();
      if (trimmed.startsWith('#')) {
        const sceneName = stripPrefix(trimmed, '#');
        if (sceneName === targetSceneId) {
          inTargetScene = true;
        } else if (inTargetScene) {
          // Found next scene after target - insert before it
          insertIdx = i;
          break;
        }
      }
    }
    result.splice(insertIdx, 0, ...newOptionLines);
  }

  return result;
}
