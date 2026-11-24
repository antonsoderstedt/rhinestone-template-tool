/**
 * Stone colours: the colour each stone will be, so a multi-colour design can be told apart on screen and counted.
 *
 * The colour is a hex string on a stone's metadata (`stoneColour`). Cutting does not depend on it: the holes are the
 * same whatever goes in them. Pure.
 */

export interface StoneColourPreset {
  id: string;
  label: string;
  hex: string;
}

/** The colours people buy most. A design can use any hex; these are the quick picks. */
export const STONE_COLOUR_PRESETS: readonly StoneColourPreset[] = [
  { id: 'crystal', label: 'Crystal', hex: '#f3f4f8' },
  { id: 'ab', label: 'Crystal AB', hex: '#c8bdf0' },
  { id: 'jet', label: 'Jet black', hex: '#1c1c21' },
  { id: 'gold', label: 'Gold', hex: '#d4af37' },
  { id: 'silver', label: 'Silver', hex: '#b9bdc7' },
  { id: 'rose', label: 'Rose', hex: '#e8a0b4' },
  { id: 'red', label: 'Red', hex: '#c8262d' },
  { id: 'blue', label: 'Sapphire', hex: '#2f5fd0' },
  { id: 'green', label: 'Emerald', hex: '#2f9e5b' },
  { id: 'purple', label: 'Amethyst', hex: '#7b4fc9' },
];

const HEX = /^#[0-9a-f]{6}$/i;

export const isStoneColour = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

/** The stone's colour, or null when it has none (a one-colour design). */
export function stoneColourOf(stone: { metadata?: Record<string, unknown> }): string | null {
  const value = stone.metadata?.stoneColour;
  return isStoneColour(value) ? value.toLowerCase() : null;
}

export function describeStoneColour(hex: string): string {
  const preset = STONE_COLOUR_PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase());
  return preset ? preset.label : hex.toLowerCase();
}

export interface ColourCount {
  hex: string;
  label: string;
  count: number;
}

/** Stones per colour, biggest first (ties by colour so the order is stable). Stones without a colour are not counted. */
export function countStonesByColour(stones: ReadonlyArray<{ metadata?: Record<string, unknown> }>): ColourCount[] {
  const counts = new Map<string, number>();
  for (const stone of stones) {
    const hex = stoneColourOf(stone);
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, label: describeStoneColour(hex), count }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
}

/** True when the design has more than one stone colour, so showing the colours on the canvas tells something. */
export function isMultiColour(stones: ReadonlyArray<{ metadata?: Record<string, unknown> }>): boolean {
  let first: string | null = null;
  for (const stone of stones) {
    const hex = stoneColourOf(stone);
    if (!hex) continue;
    if (first === null) first = hex;
    else if (hex !== first) return true;
  }
  return false;
}

/** A readable ink for text on top of a colour. */
export function inkOn(hex: string): '#111111' | '#ffffff' {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
}

/** A copy of the stone with this colour, or without any colour when `colour` is null. */
export function withStoneColour<T extends { metadata?: Record<string, string | number | boolean> }>(stone: T, colour: string | null): T {
  const metadata = { ...(stone.metadata ?? {}) };
  if (colour && isStoneColour(colour)) metadata.stoneColour = colour.toLowerCase();
  else delete metadata.stoneColour;
  return { ...stone, metadata: Object.keys(metadata).length > 0 ? metadata : undefined };
}

/** Stones that have no colour of their own get the design's colour; the others keep theirs. */
export function applyDesignColour<T extends { metadata?: Record<string, string | number | boolean> }>(stones: readonly T[], colour: string | null): T[] {
  if (!colour || !isStoneColour(colour)) return [...stones];
  return stones.map((stone) => (stoneColourOf(stone) ? stone : withStoneColour(stone, colour)));
}

/** The colour all the selected stones share, or null when they differ or have none. */
export function selectedColourOf(stones: ReadonlyArray<{ id: string; metadata?: Record<string, unknown> }>, selected: ReadonlySet<string>): string | null {
  let shared: string | null | undefined;
  for (const stone of stones) {
    if (!selected.has(stone.id)) continue;
    const colour = stoneColourOf(stone);
    if (shared === undefined) shared = colour;
    else if (shared !== colour) return null;
  }
  return shared ?? null;
}

/** Crystal AB (aurora borealis) has a rainbow sheen instead of one colour. */
export const AB_COLOUR = '#c8bdf0';

const mix = (hex: string, towards: number, amount: number): string => {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (towards - value) * amount);
  };
  return `#${[1, 3, 5].map((o) => channel(o).toString(16).padStart(2, '0')).join('')}`;
};

/** The three colours of a shiny stone: a highlight, the body and a darker rim, for drawing a stone that catches the light. */
export function gemShades(hex: string): { highlight: string; body: string; rim: string } {
  return { highlight: mix(hex, 255, 0.78), body: hex, rim: mix(hex, 0, 0.45) };
}
