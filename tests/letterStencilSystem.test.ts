/**
 * Letter Stencil Template Tests
 *
 * Verifies the stencil engine produces per-letter cards with typographically
 * correct widths, uniform card height, and proper cutShapes + stones geometry.
 * Uses an in-memory glyph loader so tests don't touch the local library.
 */

import { describe, it, expect } from 'vitest';
import {
  createLetterStencilTemplate,
  createBasicSvgExport,
  DEFAULT_SVG_ALPHABET_ID,
  loadRhinestoneFont,
  extractStonesFromGlyph,
  TRW_STONE_SIZE_CALIBRATION,
  type SvgAlphabetGlyphLoader,
  type SvgAlphabetId,
} from '../src/lib/rhinestone-engine/index';

function makeCircleSvg(circles: Array<{ cx: number; cy: number; r: number }>): string {
  const body = circles.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 1000 1000">
${body}
</svg>`;
}

function inMemoryLoader(glyphs: Record<string, string>): SvgAlphabetGlyphLoader {
  return {
    async loadGlyphSvg(_alphabetId: SvgAlphabetId, character: string) {
      return glyphs[character] ?? null;
    },
  };
}

function svgAlphabetSource(glyphLoader: SvgAlphabetGlyphLoader) {
  return {
    type: 'svg-alphabet' as const,
    alphabetId: DEFAULT_SVG_ALPHABET_ID,
    glyphLoader,
  };
}

// Narrow glyph (I-like) → single vertical row of circles at cx=500.
const narrowGlyph = makeCircleSvg(
  Array.from({ length: 5 }, (_, i) => ({ cx: 500, cy: 100 + i * 200, r: 30 })),
);

// Wide glyph (W-like) → three vertical rows spread across cx=100/500/900.
const wideGlyph = makeCircleSvg([
  ...Array.from({ length: 5 }, (_, i) => ({ cx: 100, cy: 100 + i * 200, r: 30 })),
  ...Array.from({ length: 5 }, (_, i) => ({ cx: 500, cy: 100 + i * 200, r: 30 })),
  ...Array.from({ length: 5 }, (_, i) => ({ cx: 900, cy: 100 + i * 200, r: 30 })),
]);

// Two glyphs with different overall heights — like "b" (ascender) vs "c"
// (x-height only). Each is a self-contained SVG file, matching how curated
// per-letter packages actually ship (no cross-file coordinate relationship).
const tallGlyph = makeCircleSvg([
  { cx: 500, cy: 100, r: 30 },
  { cx: 500, cy: 300, r: 30 },
  { cx: 500, cy: 590, r: 30 },
]);
const shortGlyph = makeCircleSvg([
  { cx: 500, cy: 590, r: 30 },
]);

describe('Letter Stencil System', () => {
  it('emits one card per non-space character', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph, C: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'ABC',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    expect(res.cards.length).toBe(3);
    expect(res.cards.map((c) => c.character)).toEqual(['A', 'B', 'C']);
  });

  it('gives wide letters a wider card than narrow letters', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph, W: wideGlyph });
    const res = await createLetterStencilTemplate({
      text: 'IW',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const cardI = res.cards.find((c) => c.character === 'I')!;
    const cardW = res.cards.find((c) => c.character === 'W')!;
    expect(cardW.widthMm).toBeGreaterThan(cardI.widthMm);
  });

  it('uses uniform card height across every card in the sheet', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph, W: wideGlyph });
    const res = await createLetterStencilTemplate({
      text: 'IWIW',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const heights = new Set(res.cards.map((c) => c.heightMm));
    expect(heights.size).toBe(1);
  });

  it('aligns letters of different heights on a shared baseline instead of centering each independently', async () => {
    // Regression test: each SVG Alphabet glyph's own BOTTOM edge is pinned to
    // the same offset from its card's bottom edge, so a tall letter and a
    // short letter share a visual baseline — not independently centered
    // within their own card by their own height (which used to make
    // short/tall letters float at different vertical positions).
    // Digits are used here (rather than letters) so this test exercises only
    // the base bottom-alignment mechanism, not the separate lowercase x-height
    // or uppercase cap-height outlier corrections covered by their own tests
    // below — a synthetic ~9x height difference is unrealistic for two
    // capitals of the same real alphabet and would trip the cap-height
    // correction instead of testing plain alignment.
    const loader = inMemoryLoader({ '1': tallGlyph, '2': shortGlyph });
    const res = await createLetterStencilTemplate({
      text: '12',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });

    const cardT = res.template.cutShapes!.find((c) => c.id === 'card-0')!;
    const cardS = res.template.cutShapes!.find((c) => c.id === 'card-1')!;
    const stonesT = res.template.stones.filter((s) => s.metadata?.character === '1');
    const stonesS = res.template.stones.filter((s) => s.metadata?.character === '2');

    const bottomT = Math.max(...stonesT.map((s) => s.center.y + s.holeDiameterMm / 2));
    const bottomS = Math.max(...stonesS.map((s) => s.center.y + s.holeDiameterMm / 2));

    // Distance from each card's bottom edge to its glyph's bottom-most stone
    // must match — that's the shared baseline holding across both letters.
    const offsetFromCardBottomT = (cardT.y + cardT.heightMm) - bottomT;
    const offsetFromCardBottomS = (cardS.y + cardS.heightMm) - bottomS;
    expect(offsetFromCardBottomT).toBeCloseTo(offsetFromCardBottomS, 3);
  });

  it('lets a known descender letter (g/j/p/q/y) hang its tail below the shared baseline instead of overflowing its card', async () => {
    // Regression test: SVG Alphabet glyphs carry no font metrics, so a
    // descender letter's full height (body + tail) used to get bottom-aligned
    // like every other letter — dragging its whole body upward, out of
    // proportion with its neighbors. The fix anchors descenders to an
    // x-height reference (the shortest non-descender lowercase glyph present)
    // instead, and grows the card to fit the tail — so the tail hangs below
    // the shared baseline without ever rendering past the card's own bottom.
    const loader = inMemoryLoader({ a: shortGlyph, g: tallGlyph });
    const res = await createLetterStencilTemplate({
      text: 'ag',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });

    const cardA = res.template.cutShapes!.find((c) => c.id === 'card-0')!;
    const cardG = res.template.cutShapes!.find((c) => c.id === 'card-1')!;
    const stonesA = res.template.stones.filter((s) => s.metadata?.character === 'a');
    const stonesG = res.template.stones.filter((s) => s.metadata?.character === 'g');

    const topA = Math.min(...stonesA.map((s) => s.center.y - s.holeDiameterMm / 2));
    const bottomA = Math.max(...stonesA.map((s) => s.center.y + s.holeDiameterMm / 2));
    const topG = Math.min(...stonesG.map((s) => s.center.y - s.holeDiameterMm / 2));
    const bottomG = Math.max(...stonesG.map((s) => s.center.y + s.holeDiameterMm / 2));

    // g's body starts at or above a's own bottom — i.e. its top sits up near
    // a's x-height body, not dragged down into what should be tail-only
    // territory (which is what plain full-height bottom-alignment produced).
    expect(topG).toBeLessThanOrEqual(bottomA + 0.01);
    // g's tail extends past a's bottom (that's the descender).
    expect(bottomG).toBeGreaterThan(bottomA);
    // Neither glyph renders outside its own card frame.
    expect(bottomA).toBeLessThanOrEqual(cardA.y + cardA.heightMm + 0.01);
    expect(bottomG).toBeLessThanOrEqual(cardG.y + cardG.heightMm + 0.01);
    expect(topA).toBeGreaterThanOrEqual(cardA.y - 0.01);
    expect(topG).toBeGreaterThanOrEqual(cardG.y - 0.01);
  });

  it('treats a capital with a decorative tail as an outlier, not the reference cap-height for every other capital', async () => {
    // Regression test: blackletter/Gothic alphabets often give one or two
    // capitals (e.g. Y, J) a swash tail curling below the normal cap line.
    // With no fixed "which capitals have tails" list to rely on (unlike
    // lowercase descenders), a capital whose height is a clear outlier vs.
    // the shortest capital present is treated the same way — anchored to the
    // normal cap-height instead of its own full height. Getting this wrong
    // previously inflated cardHeightMm for the WHOLE alphabet (since the
    // swash letter's uncorrected height set the shared reference), giving
    // every ordinary capital extra unwanted headroom above it.
    const loader = inMemoryLoader({ A: shortGlyph, B: shortGlyph, Y: tallGlyph });
    const res = await createLetterStencilTemplate({
      text: 'ABY',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });

    const cardA = res.template.cutShapes!.find((c) => c.id === 'card-0')!;
    const cardY = res.template.cutShapes!.find((c) => c.id === 'card-2')!;
    const stonesA = res.template.stones.filter((s) => s.metadata?.character === 'A');
    const stonesB = res.template.stones.filter((s) => s.metadata?.character === 'B');
    const stonesY = res.template.stones.filter((s) => s.metadata?.character === 'Y');

    const bottomA = Math.max(...stonesA.map((s) => s.center.y + s.holeDiameterMm / 2));
    const bottomB = Math.max(...stonesB.map((s) => s.center.y + s.holeDiameterMm / 2));
    const topY = Math.min(...stonesY.map((s) => s.center.y - s.holeDiameterMm / 2));
    const bottomY = Math.max(...stonesY.map((s) => s.center.y + s.holeDiameterMm / 2));

    // The two ordinary capitals share a baseline with each other.
    expect(bottomA).toBeCloseTo(bottomB, 3);
    // Y's main body starts near A/B's own bottom (not dragged far below it
    // the way plain full-height bottom-alignment would place it).
    expect(topY).toBeLessThanOrEqual(bottomA + 0.01);
    // Y's tail extends past A/B's bottom (that's the swash).
    expect(bottomY).toBeGreaterThan(bottomA);
    // Nothing overflows its own card.
    expect(bottomY).toBeLessThanOrEqual(cardY.y + cardY.heightMm + 0.01);
    expect(bottomA).toBeLessThanOrEqual(cardA.y + cardA.heightMm + 0.01);
  });

  it('uses exact baseline metrics instead of heuristics for alphabets that ship them', async () => {
    // old-english-gothic carries baselineBelowFractionByChar measured from
    // its source typeface (Old London): B hangs 13.9% of its height below the
    // baseline, o sits on it. Two synthetic glyphs of identical height must
    // come out vertically offset by exactly that fraction.
    const loader = inMemoryLoader({ B: tallGlyph, o: tallGlyph });
    const res = await createLetterStencilTemplate({
      text: 'Bo',
      source: {
        type: 'svg-alphabet' as const,
        alphabetId: 'old-english-gothic',
        glyphLoader: loader,
      },
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });

    const stonesB = res.template.stones.filter((s) => s.metadata?.character === 'B');
    const stonesO = res.template.stones.filter((s) => s.metadata?.character === 'o');
    const bottomB = Math.max(...stonesB.map((s) => s.center.y + s.holeDiameterMm / 2));
    const bottomO = Math.max(...stonesO.map((s) => s.center.y + s.holeDiameterMm / 2));
    const topB = Math.min(...stonesB.map((s) => s.center.y - s.holeDiameterMm / 2));
    const glyphHeight = bottomB - topB;

    expect(bottomB - bottomO).toBeCloseTo(glyphHeight * 0.139, 1);

    // Nothing overflows its card.
    const cardB = res.template.cutShapes!.find((c) => c.id === 'card-0')!;
    expect(bottomB).toBeLessThanOrEqual(cardB.y + cardB.heightMm + 0.01);
    expect(topB).toBeGreaterThanOrEqual(cardB.y - 0.01);
  });

  it('respects minCardWidthMm so single-stroke glyphs get a usable card', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'I',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      minCardWidthMm: 20,
    });
    expect(res.cards[0]!.widthMm).toBeGreaterThanOrEqual(20);
  });

  it('defaults to cut-sheet spacing so card frames remain separately cuttable', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      cutSheetGapMm: 5,
    });
    const frames = res.template.cutShapes!;
    expect(frames[1]!.x).toBeCloseTo(frames[0]!.x + frames[0]!.widthMm + 5, 3);
  });

  it('produces edge-to-edge cards in preview mode (no gap between adjacent cards)', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      layoutMode: 'preview',
    });
    const frames = res.template.cutShapes!;
    expect(frames.length).toBe(2);
    expect(frames[1]!.x).toBeCloseTo(frames[0]!.x + frames[0]!.widthMm, 3);
  });

  it('uses rhinestone font advance width so narrow glyph cards keep usable side spacing', async () => {
    const loaded = await loadRhinestoneFont('old-english-stone', 'SS10');
    const extracted = extractStonesFromGlyph(loaded.font, 'l');
    const diameters = extracted.stones.map((stone) => stone.diameterFontUnits).sort((a, b) => a - b);
    const medianDiameter = diameters[Math.floor(diameters.length / 2)]!;
    const scale = TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm / medianDiameter;

    const result = await createLetterStencilTemplate({
      text: 'l',
      source: {
        type: 'rhinestone-font',
        rhinestoneFontId: 'old-english-stone',
      },
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
      cardPaddingMm: 3,
      minCardWidthMm: 0,
    });

    const expectedSlotWidthMm = extracted.advanceWidth * scale;
    expect(result.cards[0]!.widthMm).toBeGreaterThanOrEqual(expectedSlotWidthMm + 6 - 0.1);
  });

  it('inserts inter-card gap in cut-sheet mode', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      layoutMode: 'cut-sheet',
      cutSheetGapMm: 5,
    });
    const frames = res.template.cutShapes!;
    expect(frames[1]!.x).toBeCloseTo(frames[0]!.x + frames[0]!.widthMm + 5, 3);
  });

  it('centres the glyph inside its card horizontally', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'I',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const frame = res.template.cutShapes![0]!;
    const xs = res.template.stones.map((s) => s.center.x);
    const glyphMidX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const frameMidX = frame.x + frame.widthMm / 2;
    expect(Math.abs(glyphMidX - frameMidX)).toBeLessThan(0.5);
  });

  it('exports a Cricut-safe SVG with both frame rects and stone circles', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const svg = createBasicSvgExport(res.template);
    // Frame rects — one per card, with rounded corners.
    const rectCount = (svg.match(/<rect id="cut-/g) ?? []).length;
    expect(rectCount).toBe(2);
    expect(svg).toContain('rx="2"');
    // Stone circles — one per stone.
    const circleCount = (svg.match(/<circle id="stone-/g) ?? []).length;
    expect(circleCount).toBe(res.template.stones.length);
    // Cricut safety: mm units on the root svg.
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toMatch(/height="[\d.]+mm"/);
  });

  it('reports unsupported characters without dropping the whole sheet', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AZ',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    expect(res.unsupportedCharacters).toEqual(['Z']);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.cards.length).toBe(1);
    expect(res.cards[0]!.character).toBe('A');
  });

  it('cut-sheet mode never auto-wraps by width — a long word stays on one row', async () => {
    // Regression test: cut-sheet mode used to wrap cards onto a new row once
    // cumulative card width exceeded a fixed sheet width, stacking letters
    // vertically even for ordinary words with no explicit newline.
    const loader = inMemoryLoader({
      S: wideGlyph, u: wideGlyph, l: wideGlyph, a: wideGlyph, y: wideGlyph,
    });
    const res = await createLetterStencilTemplate({
      text: 'Sulay',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      layoutMode: 'cut-sheet',
    });
    const frames = res.template.cutShapes!;
    expect(frames).toHaveLength(5);
    // All cards share the same row (same y) — no vertical stacking.
    const ys = new Set(frames.map((f) => f.y));
    expect(ys.size).toBe(1);
    // Cards are placed left to right in ascending x order.
    const xs = frames.map((f) => f.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('cut-sheet mode only starts a new row on an explicit newline', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph, C: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB\nC',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      layoutMode: 'cut-sheet',
    });
    const frames = res.template.cutShapes!;
    expect(frames[0]!.y).toBe(frames[1]!.y); // A, B same row
    expect(frames[2]!.y).toBeGreaterThan(frames[0]!.y); // C on the next row
    expect(frames[2]!.x).toBe(0); // new row resets to the left edge
  });

  it('produces deterministic geometry for the same input', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const options = {
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10' as const,
      targetStoneSizeMm: 3.429,
    };
    const a = await createLetterStencilTemplate(options);
    const b = await createLetterStencilTemplate(options);
    expect(a.template.stones).toEqual(b.template.stones);
    expect(a.template.cutShapes).toEqual(b.template.cutShapes);
  });
});
