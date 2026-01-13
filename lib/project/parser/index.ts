import { ConditionalEntry, EntryType, Schema, SchemaEntry } from '@/types/schema';

/**
 * Parser for the new game script format (v2):
 * - `@SCENE_NAME` - Scene declaration
 * - `goto @SCENE_NAME` - Jump to scene (or `goto @END`)
 * - `if Choice text | alias1 | alias2` - Choice with optional aliases
 * - `if [variable] Choice text` - Conditional choice (requires variable)
 * - Indented lines after `if` are the choice's response/navigation
 * - `[key: value]` - Metadata (image, allows, sets, unsets, requires)
 * - Regular text is narrative
 * - `*`, `**`, `***` prefixes indicate indentation levels (like Ink)
 */

/**
 * Convert star prefixes to space indentation.
 * `* content` becomes `  content` (2 spaces per star)
 * `** content` becomes `    content`
 * `*** content` becomes `      content`
 */
function convertStarsToIndent(line: string): string {
  const starMatch = line.match(/^(\*+)\s*/);
  if (!starMatch) return line;
  
  const starCount = starMatch[1].length;
  const indent = '  '.repeat(starCount); // 2 spaces per star
  const content = line.slice(starMatch[0].length);
  return indent + content;
}

function getIndentLevel(entry: string): number {
  const match = entry.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Parse choice line: if Choice text | alias1 | alias2 & [condition]
 * The condition comes at the end after & symbol
 * Returns { text, aliases, requires }
 */
function parseChoiceLine(line: string): {
  text: string;
  aliases?: string[];
  requires?: string;
} {
  // Remove 'if ' prefix
  let content = line.slice(3).trim();

  // Check for condition at end: ... & [variable]
  let requires: string | undefined;
  const conditionMatch = content.match(/&\s*\[([^\]]+)\]\s*$/);
  if (conditionMatch) {
    requires = conditionMatch[1].trim();
    content = content.slice(0, content.lastIndexOf('&')).trim();
  }

  // Split by | to get text and aliases
  const parts = content.split('|').map((p) => p.trim());
  const text = parts[0];
  const aliases = parts.length > 1 ? parts.slice(1) : undefined;

  return { text, aliases, requires };
}

/**
 * Parse metadata line: [key: value]
 */
function parseMetadataLine(
  line: string,
): { key: string; value: string } | null {
  const match = line.match(/^\[(\w+):\s*(.+)\]$/);
  if (match) {
    return { key: match[1], value: match[2] };
  }
  return null;
}

/**
 * Check if line is a conditional start: [if: condition] or if [condition]
 */
function parseConditionalLine(line: string): string | null {
  // Support both [if: key] and if [key] syntax
  const bracketMatch = line.match(/^\[if:\s*(.+)\]$/);
  if (bracketMatch) {
    return bracketMatch[1].trim();
  }
  
  const ifMatch = line.match(/^if\s+\[([^\]]+)\]\s*$/);
  if (ifMatch) {
    return ifMatch[1].trim();
  }
  
  return null;
}

/**
 * Check if line is an else marker: [else]
 */
function isElseLine(line: string): boolean {
  return line.trim() === '[else]';
}

export function parseIntoSchema(rawEntries: string[]): Schema {
  // Preprocess: convert star prefixes to space indentation
  const entries = rawEntries.map(convertStarsToIndent);
  
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

    // Scene declaration: @SCENE_NAME
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      schema.push({
        type: EntryType.SCENE,
        label: trimmed.slice(1).trim(),
      });
      i++;
      continue;
    }

    // Jump/goto: goto @TARGET or goto @END
    if (trimmed.startsWith('goto ')) {
      const target = trimmed.slice(5).trim();
      // Remove @ prefix if present
      const cleanTarget = target.startsWith('@') ? target.slice(1) : target;
      schema.push({
        type: EntryType.JUMP,
        target: cleanTarget,
      });
      i++;
      continue;
    }

    // Conditional: [if: condition] or if [condition]
    // Check this BEFORE options to avoid confusion with "if Choice" syntax
    const condition = parseConditionalLine(trimmed);
    if (condition) {
      const conditionalIndent = getIndentLevel(entry);
      const thenBlock: SchemaEntry[] = [];
      let elseBlock: SchemaEntry[] | undefined;

      // Collect indented entries for the then block
      i++;
      
      // Helper to collect a block of indented lines and parse them together
      const collectBlock = (startIdx: number, baseIndent: number): { entries: SchemaEntry[]; endIdx: number } => {
        const blockLines: string[] = [];
        let idx = startIdx;
        
        while (idx < entries.length) {
          const line = entries[idx];
          const lineTrimmed = line.trim();
          
          if (!lineTrimmed) {
            blockLines.push(line);
            idx++;
            continue;
          }
          
          const lineIndent = getIndentLevel(line);
          if (lineIndent > baseIndent) {
            // Dedent the line to make it relative to this block
            const dedented = line.slice(baseIndent + 1) || lineTrimmed;
            blockLines.push(dedented);
            idx++;
          } else {
            break;
          }
        }
        
        // Parse the collected block as a unit
        const parsedEntries = parseIntoSchema(blockLines);
        return { entries: parsedEntries, endIdx: idx };
      };
      
      while (i < entries.length) {
        const nextEntry = entries[i];
        const nextTrimmed = nextEntry.trim();

        if (!nextTrimmed) {
          i++;
          continue;
        }

        const nextIndent = getIndentLevel(nextEntry);

        // Check for [else] at the same level as [if: ...]
        if (nextIndent === conditionalIndent && isElseLine(nextTrimmed)) {
          // Start collecting else block
          i++;
          const elseResult = collectBlock(i, conditionalIndent);
          elseBlock = elseResult.entries;
          i = elseResult.endIdx;
          break;
        }

        // If more indented, collect and parse the entire then block
        if (nextIndent > conditionalIndent) {
          const thenResult = collectBlock(i, conditionalIndent);
          thenBlock.push(...thenResult.entries);
          i = thenResult.endIdx;
        } else {
          // Less or equal indentation (and not [else]) - done with conditional
          break;
        }
      }

      const conditionalEntry: ConditionalEntry = {
        type: EntryType.CONDITIONAL,
        condition,
        then: thenBlock,
        ...(elseBlock && { else: elseBlock }),
      };
      schema.push(conditionalEntry);
      continue;
    }

    // Choice: if Choice text | alias1 | alias2
    if (trimmed.startsWith('if ')) {
      const optionIndent = getIndentLevel(entry);
      const { text, aliases, requires } = parseChoiceLine(trimmed);
      const thenBlock: SchemaEntry[] = [];

      // Collect indented entries that follow this choice
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

        // If next entry is more indented than the choice, it's part of the then block
        if (nextIndent > optionIndent) {
          // Parse this entry recursively
          const [parsedEntry] = parseIntoSchema([nextTrimmed]);
          if (parsedEntry) {
            thenBlock.push(parsedEntry);
          }
          i++;
        } else {
          // Less or equal indentation means we're done with this choice's then block
          break;
        }
      }

      schema.push({
        type: EntryType.OPTION,
        text,
        ...(aliases && { aliases }),
        ...(requires && { requires }),
        then: thenBlock,
      });
      continue;
    }

    // Metadata: [key: value]
    const metadata = parseMetadataLine(trimmed);
    if (metadata) {
      const { key, value } = metadata;

      // Special handling for image metadata
      if (key === 'image') {
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const isValidImage = validExtensions.some(
          (ext) =>
            value.toLowerCase().endsWith(ext) ||
            value.toLowerCase().includes(ext + '?'),
        );

        if (isValidImage) {
          schema.push({ type: EntryType.IMAGE, url: value });
        } else {
          schema.push({
            type: EntryType.NARRATIVE,
            text: `[Invalid image URL: ${value}]`,
          });
        }
      } else if (key === 'allows' || key === 'sets' || key === 'unsets') {
        // Other metadata (allows, sets, unsets)
        schema.push({
          type: EntryType.METADATA,
          key: key as 'allows' | 'sets' | 'unsets',
          value,
        });
      }
      // Unknown metadata keys are ignored
      i++;
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
  if (normExisting.includes(normNew) || normNew.includes(normExisting))
    return true;

  // Check if they share the same root words (simple stemming)
  const existingWords = new Set(normExisting.split(' '));
  const newWords = normNew.split(' ');
  const sharedWords = newWords.filter((w) => existingWords.has(w));

  // If most words are shared, it's redundant
  if (sharedWords.length >= Math.max(newWords.length, existingWords.size) * 0.8)
    return true;

  return false;
}

/**
 * Parse choice from a script line to extract text and aliases
 * Format: if [condition] Choice text | alias1 | alias2
 */
function parseChoiceFromLine(line: string): {
  text: string;
  aliases?: string[];
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('if ')) return null;

  const { text, aliases } = parseChoiceLine(trimmed);
  return { text, aliases };
}

/**
 * Add an alias to a choice in the script lines.
 * Transforms "if Ride a bike" to "if Ride a bike | Cycle"
 * or "if Ride a bike | Cycle" to "if Ride a bike | Cycle | Pedal"
 * Avoids adding redundant aliases that are too similar to existing ones.
 */
export function addAliasToOption(
  lines: string[],
  optionText: string,
  newAlias: string,
): string[] {
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('if ')) return line;

    const parsed = parseChoiceFromLine(line);
    if (!parsed) return line;

    const { text, aliases } = parsed;

    // Check if this is the choice we're looking for
    if (text !== optionText) return line;

    // Check if alias is redundant with the choice text itself
    if (isRedundantAlias(text, newAlias)) return line;

    // Check if alias is redundant with any existing alias
    if (aliases?.some((existing) => isRedundantAlias(existing, newAlias)))
      return line;

    // Build new choice line with alias
    const indent = line.match(/^(\s*)/)?.[1] || '';
    const allAliases = aliases ? [...aliases, newAlias] : [newAlias];

    // Preserve condition at end if present: ... & [var]
    const conditionMatch = trimmed.match(/&\s*\[([^\]]+)\]\s*$/);
    const condition = conditionMatch ? ` & [${conditionMatch[1]}]` : '';

    return `${indent}if ${text} | ${allAliases.join(' | ')}${condition}`;
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
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      const sceneName = trimmed.slice(1).trim();
      inTargetScene = sceneName === sceneId;
      continue;
    }

    // Find the matching choice in the target scene
    if (inTargetScene && trimmed.startsWith('if ')) {
      const parsed = parseChoiceFromLine(line);
      if (parsed && parsed.text === optionText) {
        // Add the player log after the choice's then block
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
 * Add a generated choice to the script at the right location.
 * Inserts after existing choices in the given scene, or after the last narrative if no choices exist.
 */
export function addGeneratedOptionToScript(
  lines: string[],
  sceneId: string,
  optionText: string,
  aliases: string[],
  thenLines: string[],
): string[] {
  // Find the first scene marker in the script
  let firstSceneMarkerIdx = -1;
  let firstSceneName = '';
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      firstSceneMarkerIdx = i;
      firstSceneName = trimmed.slice(1).trim();
      break;
    }
  }
  
  // Handle START scene: if the first line is a scene marker (like @HOME),
  // and sceneId is 'START', we should target that first scene instead
  let targetSceneId = sceneId;
  let inImplicitStart = false;
  
  if (sceneId === 'START') {
    if (firstSceneMarkerIdx === 0 && firstSceneName) {
      // Script starts with @SCENE - START and that scene are the same
      // Target the explicit scene instead
      targetSceneId = firstSceneName;
    } else if (firstSceneMarkerIdx > 0) {
      // There's content before the first scene marker - this is implicit START
      inImplicitStart = true;
      targetSceneId = '';
    } else {
      // No scene markers at all - entire script is implicit START
      inImplicitStart = true;
      targetSceneId = '';
    }
  }

  const result: string[] = [];
  let inTargetScene = inImplicitStart;
  let lastOptionEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track scene changes
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      const sceneName = trimmed.slice(1).trim();
      
      // If we were in implicit START, we're now leaving it
      if (inImplicitStart && inTargetScene) {
        // We're transitioning out of implicit START into a named scene
        // If we found options in START, lastOptionEndIdx is set
        // If not, we need to insert before this scene marker
        if (lastOptionEndIdx === -1) {
          lastOptionEndIdx = result.length;
        }
        inTargetScene = false;
      }
      
      // Check if entering the explicit target scene
      if (!inImplicitStart) {
        inTargetScene = sceneName === targetSceneId;
      }
      
      result.push(line);
      continue;
    }

    // Track last choice position in target scene
    if (inTargetScene && trimmed.startsWith('if ')) {
      // Find end of this choice's then block
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
      // Push choice and its then block
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

  // Build the new choice block with aliases if present
  const optionLine =
    aliases.length > 0
      ? `if ${optionText} | ${aliases.join(' | ')}`
      : `if ${optionText}`;
  const newOptionLines: string[] = [
    optionLine,
    ...thenLines.map((l) => `   ${l}`),
  ];

  // Insert after the last choice in the target scene
  if (lastOptionEndIdx !== -1) {
    result.splice(lastOptionEndIdx, 0, ...newOptionLines);
  } else {
    // No choices found - find where to insert in the target scene
    // For implicit START with no scene markers, insert at end
    // For implicit START with scene markers, insert before first scene marker
    // For explicit scenes, insert before the next scene marker or at end
    let insertIdx = result.length;
    
    if (inImplicitStart) {
      // Find first scene marker in result to insert before
      for (let i = 0; i < result.length; i++) {
        const trimmed = result[i].trim();
        if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
          insertIdx = i;
          break;
        }
      }
    } else {
      // Explicit scene: find where to insert
      let foundTarget = false;
      for (let i = 0; i < result.length; i++) {
        const trimmed = result[i].trim();
        if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
          const sceneName = trimmed.slice(1).trim();
          if (sceneName === targetSceneId) {
            foundTarget = true;
          } else if (foundTarget) {
            // Found next scene after target - insert before it
            insertIdx = i;
            break;
          }
        }
      }
    }
    result.splice(insertIdx, 0, ...newOptionLines);
  }

  return result;
}
