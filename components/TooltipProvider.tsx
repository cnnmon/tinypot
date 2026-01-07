'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface TooltipState {
  content: ReactNode;
  x: number;
  y: number;
  visible: boolean;
}

interface TooltipContextValue {
  show: (content: ReactNode, x: number, y: number) => void;
  hide: () => void;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    content: null,
    x: 0,
    y: 0,
    visible: false,
  });

  const show = useCallback((content: ReactNode, x: number, y: number) => {
    setTooltip({ content, x, y, visible: true });
  }, []);

  const hide = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <TooltipContext.Provider value={{ show, hide }}>
      {children}
      {tooltip.visible && (
        <div
          className="fixed z-[100] px-2 py-1 text-sm bg-neutral-800 text-white rounded pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%) translateY(-8px)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </TooltipContext.Provider>
  );
}

export function useTooltip() {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('useTooltip must be used within a TooltipProvider');
  }
  return context;
}

// Helper hook for common tooltip trigger pattern
export function useTooltipTrigger(content: ReactNode) {
  const { show, hide } = useTooltip();

  const onMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      show(content, rect.left + rect.width / 2, rect.top);
    },
    [content, show]
  );

  return { onMouseEnter, onMouseLeave: hide };
}

