function Header() {
  return (
    <div
      className="bordered-bottom flex justify-between items-center"
      style={{
        background: 'linear-gradient(90deg, var(--color-mint) 0%, #ffffff 100%)',
      }}
    >
      <p className="font-bold text-3xl text-white outlined px-3">
        <i>tinypot</i>
      </p>
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

export default function Browser({ children }: { children: React.ReactNode }) {
  return (
    <div className="bordered shadowed flex flex-col border-[4px]! h-[calc(100vh-80px)]">
      <Header />
      {children}
    </div>
  );
}
