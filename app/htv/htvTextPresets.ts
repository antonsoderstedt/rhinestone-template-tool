/**
 * One-click text style presets — size/spacing/curve combos layered on top
 * of whatever font the layer already has, so switching styles never fights
 * the font picker.
 */

export interface HtvTextPreset {
  id: string;
  displayName: string;
  fontSizeMm: number;
  letterSpacingMm: number;
  curveAmount: number;
  align: 'left' | 'center' | 'right';
}

export const HTV_TEXT_PRESETS: readonly HtvTextPreset[] = [
  { id: 'bold-title', displayName: 'Bold title', fontSizeMm: 46, letterSpacingMm: 2, curveAmount: 0, align: 'center' },
  { id: 'fine-print', displayName: 'Fine print', fontSizeMm: 14, letterSpacingMm: 0.5, curveAmount: 0, align: 'left' },
  { id: 'wide-spaced', displayName: 'Wide spaced', fontSizeMm: 28, letterSpacingMm: 8, curveAmount: 0, align: 'center' },
  { id: 'smile-arc', displayName: 'Smile arc', fontSizeMm: 32, letterSpacingMm: 2, curveAmount: 45, align: 'center' },
  { id: 'frown-arc', displayName: 'Frown arc', fontSizeMm: 32, letterSpacingMm: 2, curveAmount: -45, align: 'center' },
  { id: 'jersey-number', displayName: 'Jersey number', fontSizeMm: 70, letterSpacingMm: 0, curveAmount: 0, align: 'center' },
];
