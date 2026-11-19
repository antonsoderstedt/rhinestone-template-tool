import * as opentype from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { layoutRhinestoneFontText, measureNativeStoneDiameterFontUnits } from '../src/lib/rhinestone-engine/index';

/**
 * Vendor rhinestone fonts draw their stones at different sizes (the SS10 packages 22 units wide at 1000 units per
 * em, SS6 14, TRW Clean Stone 72 at 2048). The layout must scale each font by ITS stone size; scaling all of them
 * by TRW's number made every other font's stones overlap.
 */
function circlePath(cx: number, cy: number, diameter: number): opentype.Path {
  const path = new opentype.Path();
  const points = 64;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const x = cx + Math.cos(angle) * (diameter / 2);
    const y = cy + Math.sin(angle) * (diameter / 2);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.lineTo(cx + diameter / 2, cy); // back to the start: the extractor wants a visibly closed contour
  path.close();
  return path;
}

/** A font whose letter "A" is a row of three separate stones: circle `diameter`, centres `pitch` apart. */
function fontWithStones(unitsPerEm: number, diameter: number, pitch: number): opentype.Font {
  const stones = new opentype.Path();
  for (let i = 0; i < 3; i++) stones.extend(circlePath(1000 + i * pitch, 3000, diameter));
  const built = new opentype.Font({
    familyName: 'Test', styleName: 'Regular', unitsPerEm, ascender: unitsPerEm * 0.8, descender: -unitsPerEm * 0.2,
    glyphs: [
      new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: unitsPerEm * 0.5, path: new opentype.Path() }),
      new opentype.Glyph({ name: 'A', unicode: 65, advanceWidth: unitsPerEm * 0.6, path: stones }),
    ],
  });
  // Through a real font file, as the loader sees fonts.
  return opentype.parse(built.toArrayBuffer());
}

const options = { text: 'A', targetStoneSizeId: 'SS10' as const, letterSpacingMm: 0, lineSpacingMm: 0 };

function gapsOf(layout: ReturnType<typeof layoutRhinestoneFontText>): number[] {
  const s = layout.stones;
  return [Math.hypot(s[1]!.x - s[0]!.x, s[1]!.y - s[0]!.y), Math.hypot(s[2]!.x - s[1]!.x, s[2]!.y - s[1]!.y)];
}

describe('rhinestone font scale', () => {
  it('measures the circle size of the font itself', () => {
    expect(measureNativeStoneDiameterFontUnits(fontWithStones(10000, 220, 250), 'A')).toBeCloseTo(220, -1);
    expect(measureNativeStoneDiameterFontUnits(fontWithStones(20480, 720, 830), 'A')).toBeCloseTo(720, -1);
    expect(measureNativeStoneDiameterFontUnits(fontWithStones(10000, 220, 250), 'Z')).toBeNull();
  });

  it('keeps separate stones separate at any native stone size, with holes of exactly the target diameter', () => {
    for (const [unitsPerEm, diameter, pitch] of [[10000, 220, 250], [10000, 140, 168], [20480, 720, 830], [10000, 334, 382]] as const) {
      const layout = layoutRhinestoneFontText({ ...options, font: fontWithStones(unitsPerEm, diameter, pitch), targetStoneSizeMm: 3.429 });
      expect(layout.stones).toHaveLength(3);
      expect(layout.stones.every((stone) => stone.diameterMm === 3.429)).toBe(true);
      for (const gap of gapsOf(layout)) {
        expect(gap).toBeGreaterThanOrEqual(3.429); // no overlap
        expect(gap / 3.429).toBeCloseTo(pitch / diameter, 1); // the font's own spacing is preserved
      }
    }
  });

  it('gives the same shape at a different stone size, only scaled', () => {
    const font = fontWithStones(10000, 220, 250);
    const ss10 = layoutRhinestoneFontText({ ...options, font, targetStoneSizeMm: 3.429 });
    const ss6 = layoutRhinestoneFontText({ ...options, font, targetStoneSizeMm: 2.54 });
    expect(gapsOf(ss10)[0]! / gapsOf(ss6)[0]!).toBeCloseTo(3.429 / 2.54, 3);
  });

  it('is deterministic', () => {
    const font = fontWithStones(10000, 220, 250);
    expect(layoutRhinestoneFontText({ ...options, font, targetStoneSizeMm: 3.429 })).toEqual(layoutRhinestoneFontText({ ...options, font, targetStoneSizeMm: 3.429 }));
  });
});
