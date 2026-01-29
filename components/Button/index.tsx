import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-mint hover:bg-black hover:text-white',
  secondary: 'bg-white hover:bg-gray-100',
};

export default function Button({
  children,
  onClick,
  className,
  variant = 'primary',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  return (
    <button
      className={twMerge(
        'rounded-lg bordered px-3 py-2 transition-colors',
        variantStyles[variant],
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className="rounded-full bg-black text-white bordered w-8 h-8 flex items-center justify-center hover:bg-white hover:text-black transition-colors"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
