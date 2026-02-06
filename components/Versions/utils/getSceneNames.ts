/** Extract scene names from a script */
export function getSceneNames(script: string[]): Set<string> {
  const scenes = new Set<string>();
  for (const line of script) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@') && !trimmed.startsWith('@END')) {
      scenes.add(trimmed.slice(1).trim());
    }
  }
  return scenes;
}
