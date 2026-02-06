'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

interface ScrollContainerProps {
  children: ReactNode;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  gradientSize?: number;
}

export default function ScrollContainer({
  children,
  direction = 'horizontal',
  className,
  gradientSize = 40,
}: ScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const isHorizontal = direction === 'horizontal';
      const scrollSize = isHorizontal ? el.scrollWidth : el.scrollHeight;
      const clientSize = isHorizontal ? el.clientWidth : el.clientHeight;
      const maxScroll = Math.max(0, scrollSize - clientSize);
      const position = isHorizontal ? el.scrollLeft : el.scrollTop;

      const nextHasOverflow = scrollSize > clientSize;
      const nextIsAtStart = position <= 0;
      const nextIsAtEnd = position >= maxScroll - 1;

      setHasOverflow((prev) => (prev !== nextHasOverflow ? nextHasOverflow : prev));
      setIsAtStart((prev) => (prev !== nextIsAtStart ? nextIsAtStart : prev));
      setIsAtEnd((prev) => (prev !== nextIsAtEnd ? nextIsAtEnd : prev));
    };

    const onScroll = () => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        measure();
      });
    };

    measure();

    el.addEventListener('scroll', onScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    window.addEventListener('resize', measure, { passive: true } as AddEventListenerOptions);

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [direction]);

  const maskClasses = useMemo(() => {
    if (!hasOverflow) return '';
    const size = `${gradientSize}px`;

    if (direction === 'horizontal') {
      if (!isAtStart && !isAtEnd) {
        return `[mask-image:linear-gradient(to_right,transparent_0,black_${size},black_calc(100%-${size}),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_${size},black_calc(100%-${size}),transparent_100%)]`;
      }
      if (!isAtStart) {
        return `[mask-image:linear-gradient(to_right,transparent_0,black_${size})] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_${size})]`;
      }
      if (!isAtEnd) {
        return `[mask-image:linear-gradient(to_left,transparent_0,black_${size})] [-webkit-mask-image:linear-gradient(to_left,transparent_0,black_${size})]`;
      }
    } else {
      if (!isAtStart && !isAtEnd) {
        return `[mask-image:linear-gradient(to_bottom,transparent_0,black_${size},black_calc(100%-${size}),transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_${size},black_calc(100%-${size}),transparent_100%)]`;
      }
      if (!isAtStart) {
        return `[mask-image:linear-gradient(to_bottom,transparent_0,black_${size})] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_${size})]`;
      }
      if (!isAtEnd) {
        return `[mask-image:linear-gradient(to_top,transparent_0,black_${size})] [-webkit-mask-image:linear-gradient(to_top,transparent_0,black_${size})]`;
      }
    }

    return '';
  }, [direction, gradientSize, hasOverflow, isAtStart, isAtEnd]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={scrollRef}
      className={twMerge(
        isHorizontal
          ? 'overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
          : 'overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        maskClasses,
        className,
      )}
    >
      {children}
    </div>
  );
}
