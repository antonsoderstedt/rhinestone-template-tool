import { describe, expect, it } from 'vitest';
import { pickArtboard, relativeLuminance } from '../app/htv/artboard';

describe('HTV artboard', () => {
  it('measures luminance from black to white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('nonsense')).toBe(0.5);
  });

  it('puts black vinyl on a light sheet and white vinyl on a dark one', () => {
    expect(pickArtboard(['#161616']).tone).toBe('light'); // the default vinyl colour
    expect(pickArtboard(['#f7f6f3']).tone).toBe('dark');
  });

  it('uses mid-grey when light and dark vinyl are mixed, so both stay visible', () => {
    expect(pickArtboard(['#161616', '#f7f6f3']).tone).toBe('neutral');
  });

  it('keeps mid-tone colours readable on a light sheet and has a default for an empty design', () => {
    expect(pickArtboard(['#c22a2a', '#20304f']).tone).toBe('light');
    expect(pickArtboard([]).tone).toBe('light');
  });

  it('gives a visible contrast between the sheet and the vinyl it is chosen for', () => {
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    expect(contrast(pickArtboard(['#161616']).fill, '#161616')).toBeGreaterThan(7);
    expect(contrast(pickArtboard(['#f7f6f3']).fill, '#f7f6f3')).toBeGreaterThan(7);
    const neutral = pickArtboard(['#161616', '#f7f6f3']).fill;
    expect(contrast(neutral, '#161616')).toBeGreaterThan(3);
    expect(contrast(neutral, '#f7f6f3')).toBeGreaterThan(2.5);
  });
});
