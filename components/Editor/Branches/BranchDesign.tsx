'use client';

import { useMemo } from 'react';

const FILL = 'white';
const STROKE_WIDTH = 1.5;
const DECORATION_LIKELIHOOD = 0.1;
const LEAF_LIKELIHOOD = 1;

interface Point {
  x: number;
  y: number;
}

interface Decoration {
  type: 'leaf' | 'flower';
  x: number;
  y: number;
  rotation: number;
}

interface BranchProps {
  width?: number;
  height?: number;
  seed: number;
  color?: string;
  className?: string;
}

// Seeded random number generator for reproducibility
function seededRandom(seed: number) {
  const m = 0x80000000;
  const a = 1103515245;
  const c = 12345;
  let state = seed;
  return () => {
    state = (a * state + c) % m;
    return state / m;
  };
}

// Interpolate along a quadratic bezier
function quadraticPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

export default function Branch({
  width = 65,
  height = 71,
  seed,
  color = 'currentColor',
  className,
}: BranchProps) {
  const paths = useMemo(() => {
    const random = seededRandom(seed);
    const lines: string[] = [];
    const decorations: Decoration[] = [];

    // Main stem
    const baseX = width * (0.35 + random() * 0.2);
    const baseY = height * 0.92;
    const tipY = height * (0.12 + random() * 0.15);
    const curve = (random() - 0.5) * width * 0.3;

    const stem = {
      start: { x: baseX, y: baseY },
      ctrl: { x: baseX + curve * 0.5, y: height * 0.5 },
      end: { x: baseX + curve, y: tipY },
    };

    lines.push(
      `M ${stem.start.x} ${stem.start.y} Q ${stem.ctrl.x} ${stem.ctrl.y} ${stem.end.x} ${stem.end.y}`,
    );

    // Pick decoration type randomly
    const pickDecoration = (): 'leaf' | 'flower' => {
      return random() < LEAF_LIKELIHOOD ? 'leaf' : 'flower';
    };

    // Check if decoration fits within bounds
    const fitsInBounds = (x: number, y: number, type: 'leaf' | 'flower'): boolean => {
      const margin = type === 'leaf' ? 5 : 10; // approximate decoration radius
      return x >= margin && x <= width - margin && y >= margin && y <= height - margin;
    };

    const stemTipDecoration = pickDecoration();
    if (fitsInBounds(stem.end.x, stem.end.y, stemTipDecoration)) {
      decorations.push({
        type: stemTipDecoration,
        x: stem.end.x,
        y: stem.end.y,
        rotation: random() * 360,
      });
    }

    // 2-3 side branches, alternating sides to prevent overlap
    const branchCount = 2 + Math.floor(random() * 2);
    const startingSide = random() > 0.5 ? 1 : -1;

    for (let i = 0; i < branchCount; i++) {
      // Space branches evenly along stem, from bottom to top
      const t = 0.3 + (i / branchCount) * 0.45;
      const origin = quadraticPoint(stem.start, stem.ctrl, stem.end, t);

      // Alternate sides: even index = starting side, odd = opposite
      const side = i % 2 === 0 ? startingSide : -startingSide;
      const len = width * (0.2 + random() * 0.15);

      // Branch angle goes outward and slightly upward
      const angle = -Math.PI / 2 + side * (0.5 + random() * 0.4);

      const endPt: Point = {
        x: origin.x + Math.cos(angle) * len,
        y: origin.y + Math.sin(angle) * len * 0.7,
      };

      const ctrlPt: Point = {
        x: origin.x + (endPt.x - origin.x) * 0.5,
        y: origin.y + (endPt.y - origin.y) * 0.5,
      };

      lines.push(`M ${origin.x} ${origin.y} Q ${ctrlPt.x} ${ctrlPt.y} ${endPt.x} ${endPt.y}`);

      const pseudoRandom = (offset: number) => ((random() * 10 + offset) % 10) / 10;
      if (pseudoRandom(30) < DECORATION_LIKELIHOOD) {
        const branchDecoration = pickDecoration();
        if (fitsInBounds(endPt.x, endPt.y, branchDecoration)) {
          const alpha = pseudoRandom(5000);
          decorations.push({
            type: branchDecoration,
            x: endPt.x,
            y: endPt.y,
            rotation: side === -1 ? alpha * -80 : alpha * 80,
          });
        }
      }
    }

    return { lines, decorations };
  }, [seed, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Branches */}
      {paths.lines.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
      ))}

      {/* Decorations at branch tips */}
      {paths.decorations.map((dec, i) => {
        if (dec.type === 'leaf') {
          return (
            <path
              key={i}
              d="M0 0 C -6 -5 -8 -14 0 -18 C 8 -14 6 -5 0 0"
              fill={FILL}
              stroke={color}
              strokeWidth={STROKE_WIDTH * 1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${dec.x}, ${dec.y}) rotate(${dec.rotation}) scale(0.4)`}
            />
          );
        }
        // flower: clean 4-petal clover (outer contour only)
        return (
          <path
            key={i}
            d="M-2 -3 C -5 -5 -7 -8 -7 -12 C -7 -17 -4 -20 0 -20 C 4 -20 7 -17 7 -12 C 7 -8 5 -5 2 -3 C 5 -5 8 -7 12 -7 C 17 -7 20 -4 20 0 C 20 4 17 7 12 7 C 8 7 5 5 3 2 C 5 5 7 8 7 12 C 7 17 4 20 0 20 C -4 20 -7 17 -7 12 C -7 8 -5 5 -3 2 C -5 5 -8 7 -12 7 C -17 7 -20 4 -20 0 C -20 -4 -17 -7 -12 -7 C -8 -7 -5 -5 -2 -3 Z"
            fill={FILL}
            stroke={color}
            strokeWidth={STROKE_WIDTH * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`translate(${dec.x}, ${dec.y}) rotate(${dec.rotation}) scale(0.4)`}
          />
        );
      })}
    </svg>
  );
}
