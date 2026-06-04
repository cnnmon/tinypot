'use client';

import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { ComponentType, SVGProps, useEffect, useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { randomGradient } from '@/lib/gradient';

export interface ProjectCardMenuItem {
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
}

interface ProjectCardProps {
  name: string;
  imageUrl: string;
  onClick: () => void;
  menuItems?: ProjectCardMenuItem[];
  className?: string;
  buttonClassName?: string;
  variant?: 'default' | 'desktop';
  // Optional seed so each project keeps a stable gradient across renders
  gradientSeed?: string | number;
}

export default function ProjectCard({
  name,
  imageUrl,
  onClick,
  menuItems,
  className,
  buttonClassName,
  variant = 'default',
  gradientSeed,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const gradient = useMemo(() => randomGradient(gradientSeed ?? name), [gradientSeed, name]);
  const isDesktop = variant === 'desktop';

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <div className={twMerge('relative group bg-white', className)}>
      <button
        onClick={onClick}
        className={twMerge(
          isDesktop
            ? 'relative w-full text-center cursor-pointer justify-between border-2 p-2 bg-white transition-colors hover:bg-[#f4f7e9]'
            : 'relative overflow-hidden w-50 text-center cursor-pointer justify-between border-2 p-2 transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-1 group-hover:shadow-[4px_4px_0_0_#000]',
          buttonClassName,
        )}
      >
        {!isDesktop && (
          <div className="absolute inset-0 mix-blend-multiply z-[1]" style={{ background: gradient.css }} />
        )}
        {!isDesktop && (
          <div
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 z-[5] -skew-x-12 bg-white/35 opacity-0 transition-all duration-500 ease-out group-hover:left-[125%] group-hover:opacity-100"
            aria-hidden
          />
        )}
        <Image
          width={100}
          height={100}
          className={twMerge('w-auto relative mx-auto', isDesktop ? 'h-26' : 'h-30')}
          src={imageUrl}
          alt={name}
        />
        <p>{name}</p>
      </button>
      {menuItems && menuItems.length > 0 && (
        <div ref={menuRef} className="absolute top-1 right-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className={twMerge(
              'm-1 hover:bg-black hover:text-white',
              menuOpen ? 'bg-black text-white' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 min-w-32 bg-white border-2 shadow-md z-20">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black hover:text-white text-left cursor-pointer"
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {item.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
