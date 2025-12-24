import Image from 'next/image';
import { twMerge } from 'tailwind-merge';

const iconToIconMap = {
  branch: '/icons/Branch.svg',
  caretDown: '/icons/CaretDown.svg',
  folderOpen: '/icons/FolderOpen.svg',
  hourglass: '/icons/HourglassHigh.svg',
  leaf: '/icons/Leaf.svg',
  plantPot: '/icons/PlantPot.svg',
  scissors: '/icons/Scissors.svg',
};

export default function Box({
  title,
  subtitle,
  icon,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const Icon = iconToIconMap[icon as keyof typeof iconToIconMap];
  return (
    <div className={twMerge('flex flex-col bordered p-3 gap-2 min-w-1/4 w-full', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{title}</p>
        {Icon && <Image src={Icon} alt={title} width={20} height={20} />}
      </div>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      {children}
    </div>
  );
}
