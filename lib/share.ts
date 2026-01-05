/**
 * Share link utilities.
 * Obfuscates project IDs so users can't easily find the editor URL.
 */

const SHARE_PREFIX = 'p_';

/**
 * Encode a project ID into a share ID.
 * Reverses and base64 encodes to obfuscate.
 */
export function encodeShareId(projectId: string): string {
  // Reverse the string
  const reversed = projectId.split('').reverse().join('');
  // Base64 encode
  const encoded = btoa(reversed);
  // URL-safe base64 and add prefix
  return SHARE_PREFIX + encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a share ID back to a project ID.
 * Returns null if invalid.
 */
export function decodeShareId(shareId: string): string | null {
  try {
    if (!shareId.startsWith(SHARE_PREFIX)) return null;

    // Remove prefix
    let encoded = shareId.slice(SHARE_PREFIX.length);
    // Restore base64 padding and chars
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (encoded.length % 4)) % 4;
    encoded += '='.repeat(padding);

    // Decode and reverse
    const reversed = atob(encoded);
    return reversed.split('').reverse().join('');
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

