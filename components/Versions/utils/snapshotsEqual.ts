/** Check if two snapshots have identical content */
export function snapshotsEqual(
  a: { script: string[]; guidebook: string },
  b: { script: string[]; guidebook: string },
): boolean {
  return a.script.join('\n') === b.script.join('\n') && a.guidebook === b.guidebook;
}
