import { twMerge } from 'tailwind-merge';

export default function Box({
  className,
  style,
  children,
  onClick,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      style={style}
      className={twMerge('flex flex-col bordered p-3 gap-2 min-w-1/4 w-full', className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
