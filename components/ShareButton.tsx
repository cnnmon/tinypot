'use client';

import { useProject } from '@/lib/project';
import { getShareUrl } from '@/lib/share';
import { useState } from 'react';

export default function ShareButton() {
  const { projectId } = useProject();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!projectId) return;

    const shareUrl = getShareUrl(projectId);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      prompt('Copy this link:', shareUrl);
    }
  };

  return <button onClick={handleShare}>{copied ? '✓ Copied!' : 'Share'}</button>;
}
