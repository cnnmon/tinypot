import { twMerge } from 'tailwind-merge';

function Header() {
  return (
    <div
      className="bordered-bottom flex justify-between items-center bordered-top"
      style={{
        background: 'linear-gradient(90deg, var(--color-mint) 0%, #ffffff 100%)',
      }}
    >
      <p className="font-bold text-3xl italic text-white outlined px-3">tinypot</p>
      <div className="flex">
        <div className="flex justify-center bordered-left bg-white w-10 font-black text-3xl select-none">
          -
        </div>
        <div className="flex justify-center  bordered-left bg-white w-10 font-black text-3xl select-none">
          x
        </div>
      </div>
    </div>
  );
}

export default function Browser({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="bordered shadowed bg-white h-[calc(100vh-3rem)] flex flex-col border-[4px]!">
      <Header />
      <div className={twMerge('h-full flex', className)}>{children}</div>
    </div>
  );
}
