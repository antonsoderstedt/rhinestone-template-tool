/**
 * HTV (heat transfer vinyl) material catalog — generic colors and finishes,
 * not tied to any vendor's product line (see chat decision log: swap in
 * real supplier names/codes later if needed).
 */

export type HtvFinish = 'standard' | 'glitter' | 'holographic' | 'metallic' | 'flock';

export interface HtvColorSwatch {
  id: string;
  name: string;
  hex: string;
  finish: HtvFinish;
}

export const HTV_FINISHES: readonly { id: HtvFinish; displayName: string }[] = [
  { id: 'standard', displayName: 'Standard' },
  { id: 'glitter', displayName: 'Glitter' },
  { id: 'holographic', displayName: 'Holographic' },
  { id: 'metallic', displayName: 'Metallic' },
  { id: 'flock', displayName: 'Flock' },
];

export const HTV_COLORS: readonly HtvColorSwatch[] = [
  { id: 'white', name: 'White', hex: '#f7f6f3', finish: 'standard' },
  { id: 'black', name: 'Black', hex: '#161616', finish: 'standard' },
  { id: 'red', name: 'Red', hex: '#c22a2a', finish: 'standard' },
  { id: 'navy', name: 'Navy', hex: '#20304f', finish: 'standard' },
  { id: 'royal-blue', name: 'Royal blue', hex: '#2b52c9', finish: 'standard' },
  { id: 'kelly-green', name: 'Kelly green', hex: '#1f8a45', finish: 'standard' },
  { id: 'gold', name: 'Gold', hex: '#c9a227', finish: 'metallic' },
  { id: 'silver', name: 'Silver', hex: '#b9bcc2', finish: 'metallic' },
  { id: 'neon-pink', name: 'Neon pink', hex: '#ff3d9a', finish: 'standard' },
  { id: 'purple-glitter', name: 'Purple glitter', hex: '#7c4dff', finish: 'glitter' },
  { id: 'rainbow-holo', name: 'Rainbow holographic', hex: '#8fd3ff', finish: 'holographic' },
  { id: 'heather-gray', name: 'Heather gray', hex: '#9aa0a8', finish: 'standard' },
];

export const DEFAULT_HTV_COLOR_ID = 'black';

export function getHtvColor(colorId: string): HtvColorSwatch {
  return HTV_COLORS.find((c) => c.id === colorId) ?? HTV_COLORS.find((c) => c.id === DEFAULT_HTV_COLOR_ID)!;
}
