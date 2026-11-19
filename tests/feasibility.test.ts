import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyseFeasibility, buildArtworkLayers, importSvgArtwork } from '../src/lib/rhinestone-engine/index';

const layersOf = (body: string, widthMm: number, viewBox = '0 0 200 100') =>
  buildArtworkLayers(importSvgArtwork(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`).shapes, { widthMm }).layers;
const fixtureLayers = (name: string, widthMm: number) =>
  buildArtworkLayers(importSvgArtwork(readFileSync(path.join(__dirname, 'fixtures/artwork', name), 'utf8')).shapes, { widthMm }).layers;

describe('analyseFeasibility', () => {
  it('a big solid shape is fine at every stone size', () => {
    const r = analyseFeasibility(layersOf('<rect width="200" height="100"/>', 100))!;
    expect(r.perSize.every((s) => s.verdict === 'good')).toBe(true);
    expect(r.widthMm).toBeCloseTo(100, 0);
    expect(r.thinnestPartMm).toBeNull();
  });

  it('a bar thinner than the stone is too small, and says how wide the artwork would have to be', () => {
    // 100 mm wide, bar 3 mm thick: fine for SS6 (hole 2.54), too thin for SS10 (hole 3.43)
    const layers = layersOf('<rect width="200" height="6"/>', 100, '0 0 200 6');
    const r = analyseFeasibility(layers)!;
    const ss10 = r.perSize.find((s) => s.stoneSize === 'SS10')!;
    expect(ss10.verdict).toBe('too-small');
    expect(ss10.thinAreaShare).toBeGreaterThan(0.9);
    // the bar is 3 mm thick and SS10 needs 3.43: about 1.14 times wider
    expect(ss10.suggestedWidthMm!).toBeGreaterThan(108);
    expect(ss10.suggestedWidthMm!).toBeLessThan(135);
    // a smaller stone makes it
    expect(r.perSize.find((s) => s.stoneSize === 'SS6')!.verdict).toBe('good');
  });

  it('a little thin detail on a big shape is some detail lost, not too small', () => {
    const r = analyseFeasibility(layersOf('<rect width="80" height="60"/><rect x="80" y="28" width="120" height="3"/>', 200))!;
    const ss10 = r.perSize.find((s) => s.stoneSize === 'SS10')!;
    expect(ss10.thinAreaShare).toBeGreaterThan(0.03);
    expect(ss10.verdict).toBe('some-detail-lost');
  });

  it('judges the owner’s wordmark: fine large, losing detail small', () => {
    const big = analyseFeasibility(fixtureLayers('smooch-wordmark.svg', 400))!;
    const small = analyseFeasibility(fixtureLayers('smooch-wordmark.svg', 80))!;
    const at = (r: typeof big, size: string) => r.perSize.find((s) => s.stoneSize === size)!;
    expect(at(big, 'SS10').thinAreaShare).toBeLessThan(at(small, 'SS10').thinAreaShare);
    expect(at(small, 'SS10').verdict).not.toBe('good');
    expect(at(big, 'SS6').verdict).toBe('good');
    expect(at(small, 'SS10').suggestedWidthMm!).toBeGreaterThan(80);
  });

  it('following the advice ends in a good verdict: at the suggested width the detail fits', () => {
    for (const file of ['smooch-wordmark.svg', 'local/kpop-demon-hunters.svg']) {
      let layers;
      try { layers = fixtureLayers(file, 90); } catch { continue; } // the local file is not in every checkout
      const small = analyseFeasibility(layers)!.perSize.find((s) => s.stoneSize === 'SS10')!;
      expect(small.verdict, file).not.toBe('good');
      const wide = analyseFeasibility(fixtureLayers(file, Math.ceil(small.suggestedWidthMm! / 10) * 10))!.perSize.find((s) => s.stoneSize === 'SS10')!;
      expect(wide.verdict, file).toBe('good');
    }
  });

  it('counts shapes that are too thin to get any stone: small dots and letters can vanish while the area barely changes', () => {
    // one big block and five 2 mm dots: 6 shapes, the dots are thinner than any stone hole above SS6
    const dots = [0, 1, 2, 3, 4].map((i) => `<rect x="${110 + i * 15}" y="40" width="2" height="2"/>`).join('');
    const r = analyseFeasibility(layersOf(`<rect width="100" height="100"/>${dots}`, 100, '0 0 200 100'))!;
    const ss10 = r.perSize.find((s) => s.stoneSize === 'SS10')!;
    expect(ss10.totalShapes).toBe(6);
    expect(ss10.lostShapes).toBe(5);
    expect(ss10.thinAreaShare).toBeLessThan(0.03);
  });

  it('only counts layers that get stones', () => {
    const layers = layersOf('<rect width="200" height="100" fill="#fff"/><rect x="50" y="48" width="100" height="4" fill="#000"/>', 100);
    expect(analyseFeasibility(layers)!.heightMm).toBeLessThan(6);
  });

  it('gives nothing when no layer gets stones', () => {
    expect(analyseFeasibility([])).toBeNull();
  });

  it('is deterministic', () => {
    expect(analyseFeasibility(fixtureLayers('smooch-lips.svg', 120))).toEqual(analyseFeasibility(fixtureLayers('smooch-lips.svg', 120)));
  });
});
