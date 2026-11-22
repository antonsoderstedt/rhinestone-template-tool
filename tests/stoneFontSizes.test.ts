import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bestStoneFontSize,
  describeFit,
  fitRank,
  measureStoneFontSizes,
  stoneFontSizeSuggestion,
  type StoneFontSizeOption,
} from '../app/editor/stoneFontSizes';

const option = (size: 'SS6' | 'SS10' | 'SS16', diameterMm: number, widthMm: number | null, fit: StoneFontSizeOption['fit']): StoneFontSizeOption => ({
  size,
  diameterMm,
  widthMm,
  heightMm: widthMm === null ? null : 50,
  fit,
});

describe('choosing a stone size for a stone font', () => {
  it('prefers the largest stones that fit the small mat', () => {
    const options = [option('SS6', 2.54, 200, 'fits-12x12'), option('SS10', 3.429, 280, 'fits-12x12'), option('SS16', 4.5, 400, 'fits-12x24')];
    expect(bestStoneFontSize(options)?.size).toBe('SS10');
  });

  it('falls back to the big mat, then to the smallest stones when nothing fits', () => {
    expect(bestStoneFontSize([option('SS6', 2.54, 400, 'fits-12x24'), option('SS10', 3.429, 560, 'fits-12x24')])?.size).toBe('SS10');
    expect(bestStoneFontSize([option('SS6', 2.54, 700, 'too-large'), option('SS10', 3.429, 900, 'too-large')])?.size).toBe('SS6');
  });

  it('ignores sizes that could not be measured, and has no answer when none could', () => {
    expect(bestStoneFontSize([option('SS6', 2.54, null, null), option('SS10', 3.429, 280, 'fits-12x12')])?.size).toBe('SS10');
    expect(bestStoneFontSize([option('SS6', 2.54, null, null)])).toBeNull();
  });

  it('only suggests a change when it makes the words fit a smaller mat', () => {
    const options = [option('SS6', 2.54, 250, 'fits-12x12'), option('SS10', 3.429, 420, 'fits-12x24')];
    expect(stoneFontSizeSuggestion(options, 'SS10')?.size).toBe('SS6');
    expect(stoneFontSizeSuggestion(options, 'SS6')).toBeNull();
    // Both fit: bigger stones would be nicer, but nagging someone who chose SS6 on purpose is not helpful.
    const both = [option('SS6', 2.54, 150, 'fits-12x12'), option('SS10', 3.429, 210, 'fits-12x12')];
    expect(stoneFontSizeSuggestion(both, 'SS6')).toBeNull();
  });

  it('ranks and words the fit', () => {
    expect(fitRank('fits-12x12')).toBeGreaterThan(fitRank('fits-12x24'));
    expect(fitRank('fits-12x24')).toBeGreaterThan(fitRank('too-large'));
    expect(fitRank(null)).toBe(0);
    expect(describeFit('too-large')).toContain('parts');
  });
});

describe.skipIf(!existsSync('public/fonts/rhinestone'))('measuring a real stone font', () => {
  it('gives a smaller design at SS6 than at SS10 for the same words', async () => {
    const options = await measureStoneFontSizes({ fontId: 'blessed-stone', text: 'Mia', letterSpacingMm: 1, lineSpacingMm: 0 });
    const ss6 = options.find((o) => o.size === 'SS6');
    const ss10 = options.find((o) => o.size === 'SS10');
    if (!ss6?.widthMm || !ss10?.widthMm) return; // font file not present on this machine
    expect(ss6.widthMm).toBeLessThan(ss10.widthMm);
    expect(ss6.heightMm!).toBeLessThan(ss10.heightMm!);
  });
});
