/**
 * Named HTV color palettes — one-click multi-color combos applied across
 * a design's layers in z-order (bottom layer gets colorIds[0], and so on,
 * cycling if there are more layers than colors).
 */

export interface HtvColorPalette {
  id: string;
  displayName: string;
  colorIds: string[];
}

export const HTV_COLOR_PALETTES: readonly HtvColorPalette[] = [
  { id: 'classic', displayName: 'Black & white', colorIds: ['black', 'white'] },
  { id: 'bold', displayName: 'Bold primary', colorIds: ['red', 'royal-blue', 'white'] },
  { id: 'varsity', displayName: 'Varsity', colorIds: ['navy', 'gold', 'white'] },
  { id: 'pastel', displayName: 'Pastel pop', colorIds: ['neon-pink', 'purple-glitter', 'white'] },
  { id: 'metallic', displayName: 'Metallic shine', colorIds: ['gold', 'silver', 'black'] },
  { id: 'nature', displayName: 'Nature', colorIds: ['kelly-green', 'heather-gray', 'black'] },
];

export function getColorPalette(id: string): HtvColorPalette | undefined {
  return HTV_COLOR_PALETTES.find((p) => p.id === id);
}
