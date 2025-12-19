import { twMerge } from 'tailwind-merge';

export default function Button({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={twMerge(
        'rounded-lg bg-mint bordered px-3 py-2 hover:bg-black hover:text-white transition-colors',
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-full bg-black text-white bordered w-8 h-8 flex items-center justify-center hover:bg-white hover:text-black transition-colors"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
