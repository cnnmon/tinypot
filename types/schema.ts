/**
 * Types for schema.
 * Schema is the parsed version of the editor's plaintext script.
 *
 * New syntax (v2):
 * - Scenes: @SCENE_NAME
 * - Choices: if Choice text | alias1 | alias2
 * - Conditions: if [variable] Choice text
 * - Navigation: goto @SCENE_NAME
 * - Metadata: [key: value] (image, allows, sets, unsets, requires)
 */

export enum EntryType {
  NARRATIVE = 'narrative',
  JUMP = 'goto',
  OPTION = 'option',
  SCENE = 'scene',
  IMAGE = 'image',
  METADATA = 'metadata',
  CONDITIONAL = 'conditional',
}

export interface NarrativeEntry {
  type: EntryType.NARRATIVE;
  text: string;
}

export interface SceneEntry {
  type: EntryType.SCENE;
  label: string;
}

export interface JumpEntry {
  type: EntryType.JUMP;
  target: string; // Scene label or "END"
}

export interface OptionEntry {
  type: EntryType.OPTION;
  text: string; // The primary option text shown to user
  aliases?: string[]; // Alternative phrasings that match this option
  requires?: string; // Variable required to show this option
  then: SchemaEntry[]; // What happens when this option is chosen
}

export interface ImageEntry {
  type: EntryType.IMAGE;
  url: string;
}

// Metadata types
export type MetadataKey = 'image' | 'allows' | 'sets' | 'unsets';

export interface MetadataEntry {
  type: EntryType.METADATA;
  key: MetadataKey;
  value: string; // Raw value string (parsed as needed)
}

export interface ConditionalEntry {
  type: EntryType.CONDITIONAL;
  condition: string; // Variable name, supports ! prefix for negation
  then: SchemaEntry[];
  else?: SchemaEntry[];
}

// Parsed allows value for convenience
export interface AllowsConfig {
  scenes: string[]; // Specific scene names allowed (without @)
  allowNew: boolean; // Whether new scenes can be created
  allowAny: boolean; // Whether any existing scene is allowed (default when not specified)
}

export type SchemaEntry =
  | NarrativeEntry
  | OptionEntry
  | JumpEntry
  | SceneEntry
  | ImageEntry
  | MetadataEntry
  | ConditionalEntry;

export type Schema = SchemaEntry[];

// Helper to parse allows metadata value
export function parseAllows(value: string | undefined): AllowsConfig {
  // Default: can link to any existing scene, but cannot create new
  if (!value) {
    return { scenes: [], allowNew: false, allowAny: true };
  }

  const parts = value.split(',').map((p) => p.trim());
  const scenes: string[] = [];
  let allowNew = false;

  for (const part of parts) {
    if (part === 'new') {
      allowNew = true;
    } else if (part === 'none') {
      // Explicit none - no linking allowed
      return { scenes: [], allowNew: false, allowAny: false };
    } else if (part.startsWith('@')) {
      scenes.push(part.slice(1)); // Remove @ prefix
    }
  }

  return { scenes, allowNew, allowAny: scenes.length === 0 && !allowNew };
}
