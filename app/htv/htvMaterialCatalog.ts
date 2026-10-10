/**
 * HTV (heat transfer vinyl) material catalog.
 *
 * Colors/finishes are still a generic palette, not tied to any vendor's
 * product line — but each swatch now carries a `vendor` slot so real
 * supplier data (Siser, Stahl's, etc.) can be filled in later without a
 * schema change. `vendor` is `null` on every entry today: nobody has
 * supplied real product names, SKUs, or vendor color names yet, and this
 * file must never invent ones that look real — a designer could order
 * against a fabricated SKU. Fill `vendor` in only from an actual supplier
 * catalog/spec sheet.
 */

export type HtvFinish = 'standard' | 'glitter' | 'holographic' | 'metallic' | 'flock';

/**
 * A real supplier's mapping for a swatch. Every field is required once you
 * do have a vendor match — don't half-fill this with guessed values.
 */
export interface HtvVendorMaterialInfo {
  /** e.g. 'Siser', "Stahl's". */
  brand: string;
  /** e.g. 'EasyWeed', 'CAD-CUT ThermoFlex Plus'. */
  productLine: string;
  /** The vendor's own SKU/part number for this exact color+line. */
  sku: string;
  /** The vendor's own name for this shade, which often differs from ours (e.g. our "Kelly green" vs their "Kelly"). */
  vendorColorName: string;
}

/**
 * General press guidance for a finish family. These are widely-published
 * industry-typical ranges (the kind printed on most HTV spec sheets for
 * that finish category), not one vendor's exact numbers — always confirm
 * against the actual roll's spec sheet once a real vendor is assigned,
 * since brands do vary by a few degrees/seconds.
 */
export interface HtvPressGuidance {
  tempCelsius: number;
  seconds: number;
  pressure: 'light' | 'medium' | 'firm';
  peel: 'hot' | 'warm' | 'cold';
  notes?: string;
}

export const HTV_FINISH_PRESS_GUIDANCE: Readonly<Record<HtvFinish, HtvPressGuidance>> = {
  standard: { tempCelsius: 150, seconds: 15, pressure: 'medium', peel: 'warm' },
  glitter: { tempCelsius: 155, seconds: 15, pressure: 'firm', peel: 'warm', notes: 'Apply as the top layer when stacking.' },
  metallic: { tempCelsius: 150, seconds: 12, pressure: 'medium', peel: 'cold', notes: 'Cold peel preserves the foil finish.' },
  holographic: { tempCelsius: 160, seconds: 15, pressure: 'medium', peel: 'cold' },
  flock: { tempCelsius: 160, seconds: 15, pressure: 'firm', peel: 'cold', notes: 'Higher heat than most finishes — don’t reuse standard settings.' },
};

export interface HtvColorSwatch {
  id: string;
  name: string;
  hex: string;
  finish: HtvFinish;
  /** Real supplier match. Null = generic swatch, not yet mapped to a real product. */
  vendor: HtvVendorMaterialInfo | null;
}

export const HTV_FINISHES: readonly { id: HtvFinish; displayName: string }[] = [
  { id: 'standard', displayName: 'Standard' },
  { id: 'glitter', displayName: 'Glitter' },
  { id: 'holographic', displayName: 'Holographic' },
  { id: 'metallic', displayName: 'Metallic' },
  { id: 'flock', displayName: 'Flock' },
];

export const HTV_COLORS: readonly HtvColorSwatch[] = [
  { id: 'white', name: 'White', hex: '#f7f6f3', finish: 'standard', vendor: null },
  { id: 'black', name: 'Black', hex: '#161616', finish: 'standard', vendor: null },
  { id: 'red', name: 'Red', hex: '#c22a2a', finish: 'standard', vendor: null },
  { id: 'navy', name: 'Navy', hex: '#20304f', finish: 'standard', vendor: null },
  { id: 'royal-blue', name: 'Royal blue', hex: '#2b52c9', finish: 'standard', vendor: null },
  { id: 'kelly-green', name: 'Kelly green', hex: '#1f8a45', finish: 'standard', vendor: null },
  { id: 'gold', name: 'Gold', hex: '#c9a227', finish: 'metallic', vendor: null },
  { id: 'silver', name: 'Silver', hex: '#b9bcc2', finish: 'metallic', vendor: null },
  { id: 'neon-pink', name: 'Neon pink', hex: '#ff3d9a', finish: 'standard', vendor: null },
  { id: 'purple-glitter', name: 'Purple glitter', hex: '#7c4dff', finish: 'glitter', vendor: null },
  { id: 'rainbow-holo', name: 'Rainbow holographic', hex: '#8fd3ff', finish: 'holographic', vendor: null },
  { id: 'heather-gray', name: 'Heather gray', hex: '#9aa0a8', finish: 'standard', vendor: null },
];

export const DEFAULT_HTV_COLOR_ID = 'black';

export function getHtvColor(colorId: string): HtvColorSwatch {
  return HTV_COLORS.find((c) => c.id === colorId) ?? HTV_COLORS.find((c) => c.id === DEFAULT_HTV_COLOR_ID)!;
}

export function getPressGuidance(finish: HtvFinish): HtvPressGuidance {
  return HTV_FINISH_PRESS_GUIDANCE[finish];
}

/** True once a swatch has a real supplier match instead of just a generic hex. */
export function hasVendorMatch(swatch: HtvColorSwatch): swatch is HtvColorSwatch & { vendor: HtvVendorMaterialInfo } {
  return swatch.vendor !== null;
}

/** Short label for tooltips/lists: the real product name+SKU once known, otherwise an explicit "generic" flag rather than silently pretending precision that isn't there. */
export function describeHtvColor(swatch: HtvColorSwatch): string {
  if (swatch.vendor) {
    return `${swatch.name} — ${swatch.vendor.brand} ${swatch.vendor.productLine} · ${swatch.vendor.vendorColorName} (${swatch.vendor.sku})`;
  }
  return `${swatch.name} (generic — no vendor match yet)`;
}
