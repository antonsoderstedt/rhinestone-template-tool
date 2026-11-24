/**
 * A ready-made rhinestone design stored as little as possible: where each stone is, how large, and which colour. A design that
 * was a 130 KB SVG of bezier curves is a few KB of numbers, and the SVG can be made again from it (circles, which the template
 * import reads back as the same stones).
 *
 * Positions and sizes are whole hundredths of a millimetre. Pure and deterministic.
 */

import type { ImportedStone } from './templateImport';

export interface CompactDesign {
  v: 1;
  /** Size of the drawing in mm (the stones' extent). */
  w: number;
  h: number;
  /** Colours used, as CSS strings; a stone's colour is an index into this list (-1 for none). */
  c: string[];
  /** Flat list, four numbers per stone: x, y, diameter (hundredths of a mm) and colour index. */
  s: number[];
}

const hundredths = (mm: number) => Math.round(mm * 100);

/** Packs imported stones. The drawing is moved so its top-left corner (stone edges included) is at 0, 0. */
export function compactFromStones(stones: readonly Pick<ImportedStone, 'center' | 'diameterMm' | 'fill'>[]): CompactDesign {
  if (stones.length === 0) return { v: 1, w: 0, h: 0, c: [], s: [] };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stone of stones) {
    const r = stone.diameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }
  const colours: string[] = [];
  const s: number[] = [];
  for (const stone of stones) {
    let index = -1;
    if (stone.fill) {
      index = colours.indexOf(stone.fill);
      if (index < 0) index = colours.push(stone.fill) - 1;
    }
    s.push(hundredths(stone.center.x - minX), hundredths(stone.center.y - minY), hundredths(stone.diameterMm), index);
  }
  return { v: 1, w: hundredths(maxX - minX) / 100, h: hundredths(maxY - minY) / 100, c: colours, s };
}

export function compactStoneCount(design: CompactDesign): number {
  return Math.floor(design.s.length / 4);
}

/** Only plain colour words and hex values are put in an attribute; anything else is dropped. */
function safeColour(value: string | undefined): string | null {
  return value && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/.test(value.trim()) ? value.trim() : null;
}

/** The design as an SVG of circles, sized in mm. */
export function compactToSvg(design: CompactDesign): string {
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${design.w}mm" height="${design.h}mm" viewBox="0 0 ${design.w} ${design.h}">`];
  for (let i = 0; i + 3 < design.s.length; i += 4) {
    const colour = design.s[i + 3]! >= 0 ? safeColour(design.c[design.s[i + 3]!]) : null;
    parts.push(`<circle cx="${design.s[i]! / 100}" cy="${design.s[i + 1]! / 100}" r="${design.s[i + 2]! / 200}"${colour ? ` fill="${colour}"` : ''}/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

export interface CompactDots {
  viewBox: string;
  /** One path per colour, each stone a zero-length round-capped segment: stroke it with the stone's diameter. */
  paths: Array<{ colour: string | null; diameter: number; d: string }>;
}

/** A picture of the design for a small preview: few elements, however many stones. */
export function compactToDots(design: CompactDesign): CompactDots {
  const groups = new Map<string, { colour: string | null; diameter: number; d: string[] }>();
  for (let i = 0; i + 3 < design.s.length; i += 4) {
    const colour = design.s[i + 3]! >= 0 ? safeColour(design.c[design.s[i + 3]!]) : null;
    const diameter = design.s[i + 2]! / 100;
    const key = `${colour ?? ''}|${diameter}`;
    const group = groups.get(key) ?? { colour, diameter, d: [] };
    group.d.push(`M${design.s[i]! / 100} ${design.s[i + 1]! / 100}h0`);
    groups.set(key, group);
  }
  return { viewBox: `0 0 ${design.w} ${design.h}`, paths: [...groups.values()].map((g) => ({ colour: g.colour, diameter: g.diameter, d: g.d.join('') })) };
}
