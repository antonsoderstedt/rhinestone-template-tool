import type { Vec2 } from '../types';

/**
 * A small stroke font (seven-segment style) for edge numbers, part numbers and page numbers. Drawn as lines so it
 * can be cut, scored or drawn by a pen and printed without any font file. Glyph box: 3 wide, 5 tall.
 */
const SEG = {
  a: [[0, 5], [3, 5]],
  b: [[3, 5], [3, 2.5]],
  c: [[3, 2.5], [3, 0]],
  d: [[0, 0], [3, 0]],
  e: [[0, 0], [0, 2.5]],
  f: [[0, 2.5], [0, 5]],
  g: [[0, 2.5], [3, 2.5]],
} as const;

const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgecd',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
};

const EXTRA: Record<string, Vec2[][]> = {
  '/': [[[0, 0], [3, 5]]],
  '.': [[[1.3, 0], [1.7, 0]]],
  x: [[[0, 0.5], [3, 4.5]], [[0, 4.5], [3, 0.5]]],
};

const GLYPH_W = 3;
const ADVANCE = 4.4;

function glyph(ch: string): Vec2[][] {
  const segs = DIGITS[ch];
  if (segs) return [...segs].map((s) => SEG[s as keyof typeof SEG].map((p) => [p[0], p[1]] as Vec2));
  return EXTRA[ch] ?? [];
}

export function textWidthEm(text: string): number {
  return Math.max(0, text.length * ADVANCE - (ADVANCE - GLYPH_W));
}

/** Polylines for `text`, centred on (x, y), `height` mm tall, rotated by `angle` (radians). */
export function strokeText(text: string, x: number, y: number, height: number, angle: number): Vec2[][] {
  const scale = height / 5;
  const width = textWidthEm(text);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: Vec2[][] = [];
  [...text].forEach((ch, i) => {
    for (const line of glyph(ch)) {
      out.push(
        line.map(([gx, gy]): Vec2 => {
          const lx = (gx + i * ADVANCE - width / 2) * scale;
          const ly = (gy - 2.5) * scale;
          return [x + c * lx - s * ly, y + s * lx + c * ly];
        }),
      );
    }
  });
  return out;
}
