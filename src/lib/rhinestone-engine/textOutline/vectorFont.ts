/**
 * Built-in vector outline font for the rhinestone engine.
 *
 * Font Outline Foundation v1 — not final typography.
 * This is a simple stroke-based font for rhinestone outline templates.
 * Future versions will parse real font files or use font outline extraction.
 *
 * Coordinate system: normalized font units (0–100 per em).
 * Character cell: x ∈ [5, 65], y ∈ [5, 85], unitsPerEm = 100.
 * advanceWidth includes a small trailing gap after the glyph body.
 */

import type { Polyline } from '../path/polyline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VectorGlyph {
  /** The character this glyph represents. */
  character: string;
  /** Horizontal advance in font units (how far the pen moves after this glyph). */
  advanceWidth: number;
  /**
   * Stroke polylines in font units.
   * Empty array for whitespace characters (e.g. space).
   */
  polylines: Polyline[];
}

export interface VectorFont {
  id: string;
  name: string;
  /** Number of font units per em (roughly equals the character cell height). */
  unitsPerEm: number;
  /** Map of character string → VectorGlyph. */
  glyphs: Record<string, VectorGlyph>;
  /** Used when a requested character has no glyph. */
  fallbackCharacter: string;
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Creates an open stroke polyline from compact [x, y] coordinate tuples. */
function o(...pts: [number, number][]): Polyline {
  return { points: pts.map(([x, y]) => ({ x, y })) };
}

/** Creates a closed outline polyline from compact [x, y] coordinate tuples. */
function cl(...pts: [number, number][]): Polyline {
  return { points: pts.map(([x, y]) => ({ x, y })), closed: true };
}

/**
 * Creates an 8-point oval outline centered at (cx, cy) with half-widths
 * (rx, ry). Using k ≈ 0.7 gives a reasonable circular approximation.
 */
function ov(cx: number, cy: number, rx: number, ry: number): Polyline {
  const k = 0.7;
  return cl(
    [Math.round(cx),          Math.round(cy - ry)],
    [Math.round(cx + rx * k), Math.round(cy - ry * k)],
    [Math.round(cx + rx),     Math.round(cy)],
    [Math.round(cx + rx * k), Math.round(cy + ry * k)],
    [Math.round(cx),          Math.round(cy + ry)],
    [Math.round(cx - rx * k), Math.round(cy + ry * k)],
    [Math.round(cx - rx),     Math.round(cy)],
    [Math.round(cx - rx * k), Math.round(cy - ry * k)],
  );
}

// ─── Glyph data ───────────────────────────────────────────────────────────────

const GLYPH_DATA: VectorGlyph[] = [

  // ── Uppercase letters A–Z ──────────────────────────────────────────────────

  { character: 'A', advanceWidth: 72, polylines: [
    o([5,85],[35,5],[65,85]),
    o([18,52],[52,52]),
  ]},

  { character: 'B', advanceWidth: 70, polylines: [
    o([10,5],[10,85]),
    o([10,5],[45,5],[60,16],[60,38],[45,48],[10,48]),
    o([10,48],[48,48],[63,58],[63,75],[48,85],[10,85]),
  ]},

  { character: 'C', advanceWidth: 70, polylines: [
    o([62,18],[45,5],[22,8],[8,24],[5,48],[8,65],[22,80],[45,85],[62,78]),
  ]},

  { character: 'D', advanceWidth: 72, polylines: [
    o([10,5],[10,85]),
    o([10,5],[40,5],[60,20],[66,45],[60,70],[40,85],[10,85]),
  ]},

  { character: 'E', advanceWidth: 68, polylines: [
    o([60,5],[10,5],[10,85],[60,85]),
    o([10,45],[52,45]),
  ]},

  { character: 'F', advanceWidth: 65, polylines: [
    o([10,5],[10,85]),
    o([10,5],[60,5]),
    o([10,45],[52,45]),
  ]},

  { character: 'G', advanceWidth: 72, polylines: [
    o([62,18],[45,5],[22,8],[8,24],[5,48],[8,65],[22,80],[45,85],[62,78],[62,52],[40,52]),
  ]},

  { character: 'H', advanceWidth: 72, polylines: [
    o([10,5],[10,85]),
    o([62,5],[62,85]),
    o([10,45],[62,45]),
  ]},

  { character: 'I', advanceWidth: 42, polylines: [
    o([8,5],[34,5]),
    o([21,5],[21,85]),
    o([8,85],[34,85]),
  ]},

  { character: 'J', advanceWidth: 65, polylines: [
    o([22,5],[55,5]),
    o([50,5],[50,68],[40,82],[24,85],[8,78]),
  ]},

  { character: 'K', advanceWidth: 70, polylines: [
    o([10,5],[10,85]),
    o([10,45],[62,5]),
    o([10,45],[62,85]),
  ]},

  { character: 'L', advanceWidth: 65, polylines: [
    o([10,5],[10,85],[62,85]),
  ]},

  { character: 'M', advanceWidth: 76, polylines: [
    o([8,85],[8,5],[38,50],[68,5],[68,85]),
  ]},

  { character: 'N', advanceWidth: 72, polylines: [
    o([10,85],[10,5],[62,85],[62,5]),
  ]},

  { character: 'O', advanceWidth: 74, polylines: [
    ov(37, 45, 32, 40),
  ]},

  { character: 'P', advanceWidth: 70, polylines: [
    o([10,5],[10,85]),
    o([10,5],[45,5],[62,18],[62,38],[45,50],[10,50]),
  ]},

  { character: 'Q', advanceWidth: 74, polylines: [
    ov(37, 45, 32, 40),
    o([52,70],[70,90]),
  ]},

  { character: 'R', advanceWidth: 70, polylines: [
    o([10,5],[10,85]),
    o([10,5],[45,5],[62,18],[62,38],[45,50],[10,50]),
    o([45,50],[65,85]),
  ]},

  { character: 'S', advanceWidth: 68, polylines: [
    o([65,18],[48,5],[22,8],[8,22],[14,42],[38,50],[58,60],[62,75],[48,85],[22,85],[8,72]),
  ]},

  { character: 'T', advanceWidth: 72, polylines: [
    o([5,5],[67,5]),
    o([36,5],[36,85]),
  ]},

  { character: 'U', advanceWidth: 72, polylines: [
    o([10,5],[10,68],[20,82],[36,85],[52,82],[62,68],[62,5]),
  ]},

  { character: 'V', advanceWidth: 72, polylines: [
    o([5,5],[36,85],[67,5]),
  ]},

  { character: 'W', advanceWidth: 80, polylines: [
    o([5,5],[20,85],[40,48],[60,85],[75,5]),
  ]},

  { character: 'X', advanceWidth: 70, polylines: [
    o([8,5],[62,85]),
    o([62,5],[8,85]),
  ]},

  { character: 'Y', advanceWidth: 72, polylines: [
    o([8,5],[36,48]),
    o([64,5],[36,48]),
    o([36,48],[36,85]),
  ]},

  { character: 'Z', advanceWidth: 70, polylines: [
    o([8,5],[62,5],[8,85],[62,85]),
  ]},

  // ── Digits 0–9 ────────────────────────────────────────────────────────────

  { character: '0', advanceWidth: 72, polylines: [
    ov(36, 45, 31, 40),
    o([14,72],[56,22]),          // slash to distinguish from O
  ]},

  { character: '1', advanceWidth: 42, polylines: [
    o([15,22],[30,5],[30,85]),
    o([10,85],[50,85]),
  ]},

  { character: '2', advanceWidth: 70, polylines: [
    o([8,22],[22,8],[45,5],[62,20],[62,40],[8,82],[8,85],[68,85]),
  ]},

  { character: '3', advanceWidth: 70, polylines: [
    o([8,18],[28,5],[52,8],[65,22],[65,42],[45,52]),
    o([45,52],[65,62],[65,78],[50,85],[24,85],[8,72]),
  ]},

  { character: '4', advanceWidth: 70, polylines: [
    o([48,5],[8,52],[68,52]),
    o([48,5],[48,85]),
  ]},

  { character: '5', advanceWidth: 68, polylines: [
    o([62,5],[8,5],[8,45],[38,40],[58,52],[58,68],[45,82],[20,85],[8,72]),
  ]},

  { character: '6', advanceWidth: 70, polylines: [
    o([58,15],[38,5],[18,12],[8,30],[5,52],[8,72],[22,82],[42,85],[60,78],[65,62],[58,50],[36,44],[8,46]),
  ]},

  { character: '7', advanceWidth: 70, polylines: [
    o([8,5],[65,5],[28,85]),
  ]},

  { character: '8', advanceWidth: 70, polylines: [
    ov(35, 30, 27, 25),
    ov(35, 63, 27, 25),
  ]},

  { character: '9', advanceWidth: 70, polylines: [
    ov(36, 33, 28, 28),
    o([64,38],[62,72],[48,85],[25,85]),
  ]},

  // ── Punctuation ───────────────────────────────────────────────────────────

  { character: '.', advanceWidth: 32, polylines: [
    o([12,77],[12,85]),
  ]},

  { character: ',', advanceWidth: 32, polylines: [
    o([12,75],[8,88]),
  ]},

  { character: '!', advanceWidth: 32, polylines: [
    o([14,5],[14,62]),
    o([14,72],[14,82]),
  ]},

  { character: '?', advanceWidth: 68, polylines: [
    o([8,22],[22,8],[45,5],[62,18],[62,38],[36,52],[36,62]),
    o([36,72],[36,82]),
  ]},

  { character: '-', advanceWidth: 60, polylines: [
    o([8,42],[52,42]),
  ]},

  { character: '_', advanceWidth: 70, polylines: [
    o([5,87],[65,87]),
  ]},

  // ── Space ─────────────────────────────────────────────────────────────────

  { character: ' ', advanceWidth: 38, polylines: [] },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/** All characters supported by the built-in vector font. */
export const SUPPORTED_VECTOR_FONT_CHARACTERS: string[] = GLYPH_DATA.map(
  (g) => g.character,
);

/**
 * The built-in vector outline font (Font Outline Foundation v1).
 *
 * NOT final typography. Glyphs are deterministic stroke-based outlines.
 * Future: real TTF/OTF parsing, font upload, fill mode, better kerning.
 */
export const BUILT_IN_VECTOR_FONT: VectorFont = {
  id: 'built-in-vector-outline-v1',
  name: 'Built-in Vector Outline v1',
  unitsPerEm: 100,
  glyphs: Object.fromEntries(GLYPH_DATA.map((g) => [g.character, g])),
  fallbackCharacter: '?',
};

/**
 * Returns the VectorGlyph for `character`.
 *
 * Lookup order:
 * 1. character as-is (supports defined punctuation and digits)
 * 2. character uppercased (maps lowercase → uppercase glyph)
 * 3. fallback glyph ('?') — for any other unsupported character
 */
export function getVectorGlyph(character: string): VectorGlyph {
  const font = BUILT_IN_VECTOR_FONT;
  const direct = font.glyphs[character];
  if (direct) return direct;
  const upper = character.toUpperCase();
  const upGlyph = font.glyphs[upper];
  if (upGlyph) return upGlyph;
  return font.glyphs[font.fallbackCharacter]!;
}
