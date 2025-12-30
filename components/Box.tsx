import { twMerge } from 'tailwind-merge';

export default function Box({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      style={style}
      className={twMerge('flex flex-col bordered p-3 gap-2 min-w-1/4 w-full', className)}
    >
      {children}
    </div>
  );
}
