import { describe, expect, it } from 'vitest';
import { compactFromStones, compactStoneCount, compactToDots, compactToSvg, createImportedTemplate, importRhinestoneTemplate } from '../src/lib/rhinestone-engine/index';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="300mm" height="200mm" viewBox="0 0 30000 20000"><circle cx="5000" cy="4000" r="165" fill="#ff0000"/><circle cx="5600" cy="4000" r="165" fill="#ff0000"/><circle cx="5300" cy="4520" r="165" fill="#0000ff"/></svg>';

describe('compact design', () => {
  const imported = importRhinestoneTemplate({ svgText: SVG, applyPageScale: true });
  const compact = compactFromStones(imported.stones);

  it('keeps every stone, its size and its colour, with the drawing moved to 0, 0', () => {
    expect(compactStoneCount(compact)).toBe(3);
    expect(compact.c).toEqual(['#ff0000', '#0000ff']);
    expect(compact.w).toBeCloseTo(9.3, 1); // 6 mm between outer centres + one 3.3 mm stone
    expect(compact.s.slice(0, 4)).toEqual([165, 165, 330, 0]);
  });

  it('makes an SVG that imports back as the same stones (size, spacing, colour)', () => {
    const back = createImportedTemplate({ svgText: compactToSvg(compact), defaultStoneSizeId: 'SS10', deduplicateTolerance: 0.01 });
    expect(back.template.stones).toHaveLength(3);
    const xs = back.template.stones.map((stone) => stone.center.x).sort((a, b) => a - b);
    expect(xs[2]! - xs[0]!).toBeCloseTo(6, 2);
    expect(back.template.stones.every((stone) => Math.abs(stone.holeDiameterMm - 3.3) < 0.01)).toBe(true);
    expect(back.detectedColors).toEqual(expect.arrayContaining(['#ff0000', '#0000ff']));
  });

  it('draws a small preview with one path per colour, however many stones', () => {
    const dots = compactToDots(compact);
    expect(dots.paths).toHaveLength(2);
    expect(dots.paths.find((p) => p.colour === '#ff0000')!.d.match(/M/g)).toHaveLength(2);
  });

  it('does not put anything but a plain colour in the SVG', () => {
    const hostile = { ...compact, c: ['"/><script>alert(1)</script>'] };
    expect(compactToSvg(hostile)).not.toContain('script');
  });

  it('copes with no stones', () => {
    expect(compactFromStones([])).toEqual({ v: 1, w: 0, h: 0, c: [], s: [] });
  });
});
