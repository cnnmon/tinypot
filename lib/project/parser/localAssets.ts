// Shorthand image paths that map to bundled files in public/assets.
// Lets scripts write [image: /fire.gif] instead of a full URL.
export const LOCAL_ASSETS: Record<string, string> = {
  '/fire.gif': '/assets/fire.gif',
  '/room.png': '/assets/room.png',
  '/table.png': '/assets/table.png',
  '/tablenokey.png': '/assets/tablenokey.png',
};

export function resolveImageUrl(url: string): string {
  const trimmed = url.trim();
  return LOCAL_ASSETS[trimmed] ?? LOCAL_ASSETS['/' + trimmed] ?? url;
}
