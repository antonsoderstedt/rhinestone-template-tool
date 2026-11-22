/**
 * Ready-made shapes for the Artwork tool: hearts, stars, crowns and so on, as plain SVG, so they go through exactly the
 * same layout as a file the user uploads. One colour each, drawn in a 100 x 100 box.
 *
 * Pure: the paths are computed here, nothing is fetched.
 */

export interface GalleryShape {
  id: string;
  label: string;
  svg: string;
}

const FILL = '#8b5cf6';
const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
const path = (d: string, rule: 'nonzero' | 'evenodd' = 'nonzero') => `<path d="${d}" fill="${FILL}" fill-rule="${rule}"/>`;
const r2 = (n: number) => Math.round(n * 100) / 100;

function starPath(points: number, outer: number, inner: number, cx = 50, cy = 53): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    parts.push(`${i === 0 ? 'M' : 'L'}${r2(cx + radius * Math.cos(angle))} ${r2(cy + radius * Math.sin(angle))}`);
  }
  return `${parts.join('')}Z`;
}

/** A crescent: a disc with a smaller, shifted disc taken out, as one outline (two circular arcs). */
function crescentPath(): string {
  const [x0, y0, R] = [50, 50, 44];
  const [x1, y1, r] = [66, 40, 36];
  const d = Math.hypot(x1 - x0, y1 - y0);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const mx = x0 + (a * (x1 - x0)) / d;
  const my = y0 + (a * (y1 - y0)) / d;
  const p1 = { x: mx + (h * (y1 - y0)) / d, y: my - (h * (x1 - x0)) / d };
  const p2 = { x: mx - (h * (y1 - y0)) / d, y: my + (h * (x1 - x0)) / d };
  // Outer arc the long way round from p1 to p2, then the inner arc back (the other way, so it bites into the disc).
  return `M${r2(p1.x)} ${r2(p1.y)}A${R} ${R} 0 1 0 ${r2(p2.x)} ${r2(p2.y)}A${r} ${r} 0 1 1 ${r2(p1.x)} ${r2(p1.y)}Z`;
}

function flower(): string {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3;
    return `<circle cx="${r2(50 + 26 * Math.cos(angle))}" cy="${r2(50 + 26 * Math.sin(angle))}" r="18" fill="${FILL}"/>`;
  });
  return petals.join('') + `<circle cx="50" cy="50" r="16" fill="${FILL}"/>`;
}

export const GALLERY_SHAPES: readonly GalleryShape[] = [
  {
    id: 'heart',
    label: 'Heart',
    svg: wrap(path('M50 90C20 68 5 49 5 32C5 18 16 8 29 8C38 8 46 13 50 21C54 13 62 8 71 8C84 8 95 18 95 32C95 49 80 68 50 90Z')),
  },
  { id: 'star', label: 'Star', svg: wrap(path(starPath(5, 47, 19))) },
  { id: 'circle', label: 'Circle', svg: wrap(`<circle cx="50" cy="50" r="46" fill="${FILL}"/>`) },
  {
    id: 'ring',
    label: 'Ring',
    svg: wrap(path('M4 50a46 46 0 1 0 92 0a46 46 0 1 0-92 0ZM24 50a26 26 0 1 0 52 0a26 26 0 1 0-52 0Z', 'evenodd')),
  },
  { id: 'crown', label: 'Crown', svg: wrap(path('M8 80L8 30L30 52L50 18L70 52L92 30L92 80Z')) },
  { id: 'bolt', label: 'Lightning', svg: wrap(path('M60 4L18 56H44L36 96L82 38H55Z')) },
  { id: 'crescent', label: 'Moon', svg: wrap(path(crescentPath())) },
  { id: 'flower', label: 'Flower', svg: wrap(flower()) },
  { id: 'burst', label: 'Burst', svg: wrap(path(starPath(12, 47, 33, 50, 50))) },
];
