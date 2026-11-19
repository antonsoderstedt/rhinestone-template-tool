/**
 * The 2D HTV canvas shows the design on a flat "artboard". The vinyl colour decides which artboard works:
 * black vinyl vanishes on a dark one and white vinyl on a light one. Pure; takes the layers' hex colours.
 */

export type ArtboardTone = 'light' | 'dark' | 'neutral';

export interface Artboard {
  tone: ArtboardTone;
  fill: string;
  stroke: string;
}

const ARTBOARDS: Record<ArtboardTone, Artboard> = {
  // Light fabric-like sheet for dark vinyl.
  light: { tone: 'light', fill: '#e8e6e1', stroke: '#b9b5ad' },
  // Dark sheet for light vinyl.
  dark: { tone: 'dark', fill: '#26262b', stroke: '#3c3c44' },
  // Mid grey when light and dark vinyl are mixed: both stay visible.
  neutral: { tone: 'neutral', fill: '#8e8c96', stroke: '#6f6d78' },
};

/** WCAG relative luminance of a `#rrggbb` colour, 0 (black) to 1 (white). Unreadable input counts as mid-grey. */
export function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0.5;
  const value = parseInt(match[1]!, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function pickArtboard(layerHexColors: readonly string[]): Artboard {
  if (layerHexColors.length === 0) return ARTBOARDS.light;
  const luminances = layerHexColors.map(relativeLuminance);
  const anyLight = luminances.some((l) => l > 0.55);
  const anyDark = luminances.some((l) => l < 0.18);
  if (anyLight && anyDark) return ARTBOARDS.neutral;
  if (anyLight) return ARTBOARDS.dark;
  return ARTBOARDS.light;
}
