/**
 * Share link utilities.
 * Obfuscates project IDs so users can't easily guess editor URLs.
 */

const SHARE_PREFIX = 's_';

/**
 * Encode a project ID into a share ID.
 * Simple base64 encoding for obfuscation.
 */
export function encodeShareId(projectId: string): string {
  // Base64 encode and make URL-safe
  const encoded = btoa(projectId);
  return SHARE_PREFIX + encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a share ID back to a project ID.
 * Returns null if invalid.
 */
export function decodeShareId(shareId: string): string | null {
  try {
    if (!shareId.startsWith(SHARE_PREFIX)) return null;

    // Remove prefix and restore base64 chars
    let encoded = shareId.slice(SHARE_PREFIX.length);
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');

    // Add back padding
    const padding = (4 - (encoded.length % 4)) % 4;
    encoded += '='.repeat(padding);

    return atob(encoded);
  } catch {
    return null;
  }
}

/**
 * Generate the full share URL for a project.
 */
export function getShareUrl(projectId: string): string {
  const shareId = encodeShareId(projectId);
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/play/${shareId}`;
  }
  return `/play/${shareId}`;
}
