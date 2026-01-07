'use client';

import { useProject } from '@/lib/project';
import { getShareUrl } from '@/lib/share';
import { ArrowUpRightIcon } from '@heroicons/react/24/outline';

export default function ShareButton() {
  const { projectId } = useProject();

  const handleShare = async () => {
    if (!projectId) return;

    const shareUrl = getShareUrl(projectId);
    window.open(shareUrl, '_blank');
  };

  return (
    <button onClick={handleShare} className="px-1 flex items-center gap-1">
      share <ArrowUpRightIcon width={14} height={14} />
    </button>
  );
}
