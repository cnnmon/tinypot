'use client';

interface BrowserProps {
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  zIndex?: number;
  style?: React.CSSProperties;
}

interface HeaderProps {
  title?: string;
  onClose?: () => void;
  onMinimize?: () => void;
}

function Header({ title = 'tinypot', onClose, onMinimize }: HeaderProps) {
  return (
    <div
      className="bordered-bottom flex justify-between items-center"
      style={{
        background: 'linear-gradient(90deg, var(--color-mint) 0%, #ffffff 100%)',
      }}
    >
      <p className="font-bold text-3xl text-white outlined px-3">
        <i>{title}</i>
      </p>
      <button
        onClick={onClose}
        className="flex justify-center bordered-left bg-white w-10 font-black text-3xl select-none hover:bg-red-200 transition-colors"
      >
        x
      </button>
    </div>
  );
}

export default function Browser({
  children,
  title,
  onClose,
  onMinimize,
  zIndex = 0,
  style,
}: BrowserProps) {
  return (
    <div
      className="bordered shadowed flex flex-col border-[4px]! h-[calc(100vh-80px)]"
      style={{ zIndex, ...style }}
    >
      <Header title={title} onClose={onClose} onMinimize={onMinimize} />
      {children}
    </div>
  );
}
