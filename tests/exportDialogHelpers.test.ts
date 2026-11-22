import { describe, expect, it } from 'vitest';
import { PRINT_CHECK_SQUARE_MM, buildPrintSheetHtml, getMatFit, readSvgSizeMm, sanitizeExportFilename } from '../app/components/exportDialogHelpers';

describe('getMatFit', () => {
  it('fits a small design on a 12 x 12 in mat', () => {
    const fit = getMatFit(120, 40);
    expect(fit.status).toBe('fits-12x12');
    expect(fit.needsRotation).toBe(false);
  });

  it('recommends a 12 x 24 in mat for a design longer than 12 in', () => {
    const fit = getMatFit(400, 100);
    expect(fit.status).toBe('fits-12x24');
    expect(fit.message).toMatch(/12 × 24/);
    expect(fit.needsRotation).toBe(true);
  });

  it('does not need rotation when a tall design already fits the long side', () => {
    const fit = getMatFit(100, 400);
    expect(fit.status).toBe('fits-12x24');
    expect(fit.needsRotation).toBe(false);
  });

  it('warns when a design is larger than a 12 x 24 in mat in both orientations', () => {
    expect(getMatFit(700, 100).status).toBe('too-large');
    expect(getMatFit(350, 350).status).toBe('too-large');
  });

  it('treats the exact usable area as fitting and just over as not fitting', () => {
    expect(getMatFit(292.1, 292.1).status).toBe('fits-12x12');
    // Both mats are 292.1 mm wide, so a square just over that fits neither.
    expect(getMatFit(292.2, 292.2).status).toBe('too-large');
    expect(getMatFit(292.1, 300).status).toBe('fits-12x24');
  });

  it('reports unknown for invalid sizes', () => {
    expect(getMatFit(0, 10).status).toBe('unknown');
    expect(getMatFit(Number.NaN, 10).status).toBe('unknown');
  });
});

describe('sanitizeExportFilename', () => {
  it('adds the .svg extension and slugifies spaces', () => {
    expect(sanitizeExportFilename('My Design')).toBe('My-Design.svg');
  });

  it('never creates a double extension', () => {
    expect(sanitizeExportFilename('shirt.svg')).toBe('shirt.svg');
    expect(sanitizeExportFilename('shirt.SVG')).toBe('shirt.svg');
  });

  it('strips path separators and other illegal characters', () => {
    expect(sanitizeExportFilename('a/b\\c:d*e?"f<g>h|i')).toBe('abcdefghi.svg');
  });

  it('falls back when nothing usable is left', () => {
    expect(sanitizeExportFilename('   ')).toBe('design.svg');
    expect(sanitizeExportFilename('///', 'my-fallback')).toBe('my-fallback.svg');
    expect(sanitizeExportFilename('...hidden')).toBe('hidden.svg');
  });

  it('limits very long names', () => {
    expect(sanitizeExportFilename('x'.repeat(500)).length).toBeLessThanOrEqual(124);
  });
});

describe('readSvgSizeMm', () => {
  it('reads the root width and height in mm', () => {
    const svg = '<?xml version="1.0"?>\n<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="127.366mm"\n  height="33.43mm"\n  viewBox="0 0 1 1"\n>';
    expect(readSvgSizeMm(svg)).toEqual({ widthMm: 127.366, heightMm: 33.43 });
  });

  it('returns null when the size is not expressed in mm', () => {
    expect(readSvgSizeMm('<svg width="100" height="50"></svg>')).toBeNull();
    expect(readSvgSizeMm('not an svg')).toBeNull();
  });

  it('only reads the root element, not shapes inside it', () => {
    const svg = '<svg viewBox="0 0 1 1"><rect width="9mm" height="9mm"/></svg>';
    expect(readSvgSizeMm(svg)).toBeNull();
  });
});

describe('print sheet (plan D2, D5)', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="40mm" viewBox="0 0 100 40"><circle cx="5" cy="5" r="2"/></svg>';

  it('makes a page the size of the design with margins and a 50 mm check square', () => {
    const html = buildPrintSheetHtml(svg, { widthMm: 100, heightMm: 40 }, 'Mia design');
    expect(html).toContain('@page { size: 120mm 120mm; margin: 0; }');
    expect(html).toContain(`width: ${PRINT_CHECK_SQUARE_MM}mm; height: ${PRINT_CHECK_SQUARE_MM}mm`);
    expect(html).toContain('<circle cx="5"');
    expect(html).toContain('must measure 50 mm');
  });

  it('keeps the SVG as it is (no raster) and prints itself', () => {
    const html = buildPrintSheetHtml(svg, { widthMm: 100, heightMm: 40 }, 'x');
    expect(html).not.toMatch(/<canvas|<img|toDataURL/);
    expect(html).toContain('window.print()');
  });

  it('escapes the title', () => {
    const html = buildPrintSheetHtml(svg, { widthMm: 100, heightMm: 40 }, '<script>alert(1)</script>');
    expect(html).not.toContain('<title><script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
