/**
 * Line IDs are structured like this:
 * `${sceneId}-${lineIdx}`
 * where lineIdx is relative to the SCENE label
 *
 * i.e.
 * # SCENE
 * Hello --> 0 lineIdx
 * World --> 1 lineIdx
 *
 * This parses a lineId string, returning an object with sceneId and lineIdx,
 * or null if the format is invalid.
 */
export function parseLineId(lineId: string): { sceneId: string; lineIdx: number } | null {
  const match = /^(.+)-(\d+)$/.exec(lineId);
  if (!match) return null;
  const sceneId = match[1];
  const lineIdx = parseInt(match[2], 10);
  if (Number.isNaN(lineIdx)) return null;
  return { sceneId, lineIdx };
}
