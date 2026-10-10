import { describe, expect, it } from 'vitest';
import {
  HTV_COLORS,
  HTV_FINISHES,
  DEFAULT_HTV_COLOR_ID,
  getHtvColor,
  getPressGuidance,
  hasVendorMatch,
  describeHtvColor,
} from '../app/htv/htvMaterialCatalog';

describe('htvMaterialCatalog', () => {
  it('falls back to the default color for an unknown id', () => {
    const fallback = getHtvColor('not-a-real-id');
    expect(fallback.id).toBe(DEFAULT_HTV_COLOR_ID);
  });

  it('returns the matching swatch for a known id', () => {
    const white = getHtvColor('white');
    expect(white.name).toBe('White');
    expect(white.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('every catalog swatch is still generic (vendor: null) — no fabricated SKUs shipped', () => {
    for (const swatch of HTV_COLORS) {
      expect(swatch.vendor).toBeNull();
    }
  });

  it('hasVendorMatch is false for every current swatch', () => {
    for (const swatch of HTV_COLORS) {
      expect(hasVendorMatch(swatch)).toBe(false);
    }
  });

  it('hasVendorMatch narrows to a non-null vendor once one is set', () => {
    const withVendor = {
      ...getHtvColor('black'),
      vendor: { brand: 'Test Brand', productLine: 'Test Line', sku: 'TB-001', vendorColorName: 'Jet Black' },
    };
    expect(hasVendorMatch(withVendor)).toBe(true);
  });

  it('describeHtvColor marks generic swatches explicitly instead of implying precision', () => {
    const description = describeHtvColor(getHtvColor('gold'));
    expect(description).toContain('generic');
    expect(description).toContain('Gold');
  });

  it('describeHtvColor includes brand, line, vendor color name, and SKU once matched', () => {
    const withVendor = {
      ...getHtvColor('black'),
      vendor: { brand: 'Test Brand', productLine: 'Test Line', sku: 'TB-001', vendorColorName: 'Jet Black' },
    };
    const description = describeHtvColor(withVendor);
    expect(description).toContain('Test Brand');
    expect(description).toContain('Test Line');
    expect(description).toContain('Jet Black');
    expect(description).toContain('TB-001');
  });

  it('provides press guidance for every finish the catalog uses', () => {
    for (const finish of HTV_FINISHES) {
      const guidance = getPressGuidance(finish.id);
      expect(guidance.tempCelsius).toBeGreaterThan(0);
      expect(guidance.seconds).toBeGreaterThan(0);
      expect(['light', 'medium', 'firm']).toContain(guidance.pressure);
      expect(['hot', 'warm', 'cold']).toContain(guidance.peel);
    }
  });

  it('every catalog swatch references a finish with defined press guidance', () => {
    for (const swatch of HTV_COLORS) {
      expect(() => getPressGuidance(swatch.finish)).not.toThrow();
    }
  });
});
