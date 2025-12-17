import { useGame } from '@/hooks/game';

export default function Game() {
  const { lines } = useGame();

  return (
    <div
      className="flex-1 border-t-[2.5px] md:border-t-0 md:border-l-[2.5px] p-6 overflow-auto"
      style={{
        background: 'linear-gradient(180deg, var(--color-lime) 0%, #ffffff 100%)',
      }}
    >
      <pre className="font-mono whitespace-pre-wrap">{lines.join('\n')}</pre>
    </div>
  );
}
