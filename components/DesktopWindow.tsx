import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface DesktopWindowProps {
  brand?: string;
  title?: string;
  menuItems?: string[];
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

const DEFAULT_MENU = ['Archive', 'Edit', 'View', 'Help'];

export default function DesktopWindow({
  brand = 'bonsai',
  title = 'internet explorer',
  menuItems = DEFAULT_MENU,
  className,
  contentClassName,
  children,
}: DesktopWindowProps) {
  return (
    <article className={twMerge('border-2 border-[#95ab58] bg-[#f6f9e4] shadow-[3px_3px_0_#9eb46a]', className)}>
      {/* Small ribbon-like app brand strip, including the angled right edge. */}
      <div className="flex h-8 items-center border-b-2 border-[#a8bc73] bg-[#d7e7a1]">
        <div className="relative h-full min-w-36 border-r-2 border-[#96aa5e] bg-[#b5c76f] px-2 py-1">
          {brand}
          <span className="pointer-events-none absolute -right-8 top-0 h-full w-8 bg-[#b5c76f] [clip-path:polygon(0_0,100%_0,0_100%)]" />
        </div>
      </div>

      <div className="flex items-center justify-between border-b-2 border-[#a8bc73] bg-gradient-to-b from-[#e3f3b2] to-[#b8ce6f] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#6b7d37] bg-[#9bc3de] text-[#2d5e86]">
            o
          </span>
          <span>{title}</span>
        </div>
        <span className="grid h-6 w-6 place-items-center border border-[#728543] bg-[#d9eca6]">x</span>
      </div>

      <div className="flex items-center justify-between border-b border-[#cfd8b5] bg-[#f8faef] px-3 py-1">
        <div className="flex items-center gap-2">
          {menuItems.map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              {index > 0 && <span>|</span>}
              <span>{item}</span>
            </div>
          ))}
        </div>
        <span className="grid h-5 w-5 place-items-center rounded-full border border-[#b4be95] bg-[#ecf2da] text-[#7f8d5b]">
          *
        </span>
      </div>

      <div className={twMerge('border-t border-[#f8fce9] bg-white p-3', contentClassName)}>{children}</div>
    </article>
  );
}
