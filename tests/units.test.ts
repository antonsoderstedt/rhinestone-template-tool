import { describe, expect, it } from 'vitest';
import { MM_PER_INCH, formatLength, formatSize, isLengthUnit } from '../app/lib/units';

describe('length unit (plan A9)', () => {
  it('writes millimetres and inches', () => {
    expect(formatLength(197.34, 'mm')).toBe('197.3 mm');
    expect(formatLength(MM_PER_INCH * 2, 'in')).toBe('2.00 in');
    expect(formatSize(197.3, 110, 'mm')).toBe('197.3×110.0 mm');
    expect(formatSize(MM_PER_INCH * 8, MM_PER_INCH * 4.5, 'in')).toBe('8.00×4.50 in');
    expect(formatSize(0, 0, 'in')).toBe('0.00×0.00 in');
  });

  it('knows a unit when it sees one', () => {
    expect(isLengthUnit('mm')).toBe(true);
    expect(isLengthUnit('in')).toBe(true);
    expect(isLengthUnit('cm')).toBe(false);
    expect(isLengthUnit(null)).toBe(false);
  });
});
