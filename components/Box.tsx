import { twMerge } from 'tailwind-merge';

export default function Box({
  header,
  className,
  style,
  children,
  onClick,
}: {
  header?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      style={style}
      className={twMerge('flex flex-col bordered min-w-1/4 w-full', className)}
      onClick={onClick}
    >
      {header && (
        <div className="flex h-10 items-center justify-between gap-1 border-b-2 p-2">{header}</div>
      )}
      <div
        className={twMerge('flex flex-col justify-between h-full', header && 'h-[calc(100%-40px)]')}
      >
        {children}
      </div>
    </div>
  );
}
