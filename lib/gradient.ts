// Pick a curated pastel and fade it to white with a soft midpoint stop.

export interface GradientResult {
  primary: string;
  bg: string;
  css: string;
}

const PALETTE = [
  '#B7DCBD', // sage
  '#C8E6B0', // mint
  '#EBF7D2', // pale lime
  '#F5E9A4', // butter yellow
  '#F2D8A7', // peach
  '#F4C6CB', // blush
  '#E8C9DC', // lilac
  '#C9DCEB', // baby blue
];

function mixWithWhite(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const m = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

// Deterministic PRNG so the same seed yields the same gradient across renders/SSR.
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function randomGradient(seed?: string | number): GradientResult {
  const rand = seed === undefined ? Math.random : mulberry32(hashSeed(seed));
  const primary = PALETTE[Math.floor(rand() * PALETTE.length)];
  const middle = mixWithWhite(primary, 0.45);
  const css = `linear-gradient(180deg, ${primary} 0%, ${middle} 50%, #ffffff 100%)`;
  return { primary, bg: '#ffffff', css };
}
