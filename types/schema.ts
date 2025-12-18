/**
 * Schema is the parsed version of the editor's markdown-style IN authoring language.
 * This will be passed to the game playing hook `game.tsx`.
 */

export enum LineType {
  NARRATIVE = 'narrative',
  JUMP = 'goto',
  OPTION = 'option',
  SCENE = 'scene',
}

export interface NarrativeLine {
  type: LineType.NARRATIVE;
  text: string;
}

export interface SceneLine {
  type: LineType.SCENE;
  label: string;
}

export interface JumpLine {
  type: LineType.JUMP;
  target: string; // Scene label or "END"
}

export interface OptionLine {
  type: LineType.OPTION;
  text: string; // The option text shown to user
  then: SchemaLine[]; // What happens when this option is chosen
}

export type SchemaLine = NarrativeLine | OptionLine | JumpLine | SceneLine;
export type Schema = SchemaLine[];
