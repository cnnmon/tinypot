/**
 * Types for schema.
 * Schema is the parsed version of the editor's plaintext script.
 */

export enum EntryType {
  NARRATIVE = 'narrative',
  JUMP = 'goto',
  OPTION = 'option',
  SCENE = 'scene',
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
  then: SchemaEntry[]; // What happens when this option is chosen
}

export type SchemaEntry = NarrativeEntry | OptionEntry | JumpEntry | SceneEntry;
export type Schema = SchemaEntry[];
