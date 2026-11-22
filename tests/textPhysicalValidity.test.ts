import { describe, expect, it } from 'vitest';
import {
  OUTLINE_FONT_REGISTRY,
  checkExportReadiness,
  createOutlineTextTemplateAsync,
  getMinimumCenterDistance,
  getRecommendedHoleDiameter,
} from '../src/lib/rhinestone-engine/index';

/** Issue codes that mean the layout cannot be cut as it is. */
const NOT_CUTTABLE = new Set(['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP']);

const fonts = OUTLINE_FONT_REGISTRY.filter((font) => !font.isLegacy);
const SIZES_MM = [25, 45, 60];
const LOOKS = [
  { name: 'outline', coverageMode: 'outline' as const },
  { name: 'rows', coverageMode: 'contour' as const },
  { name: 'solid', coverageMode: 'fill' as const },
];

describe('text is physically valid in every bundled font, size and look', () => {
  for (const font of fonts) {
    for (const look of LOOKS) {
      it(`${font.fontId} · ${look.name}: stones are cuttable and every size gets stones`, async () => {
        for (const fontSizeMm of SIZES_MM) {
          const template = await createOutlineTextTemplateAsync({
            id: 'valid',
            name: 'valid',
            text: 'Sulay 2026',
            stoneSize: 'SS10',
            fontId: font.fontId,
            fontSizeMm,
            coverageMode: look.coverageMode,
            fillMode: look.coverageMode === 'contour' ? 'outline-fill' : look.coverageMode,
          });
          expect(template.stones.length, `${fontSizeMm} mm has no stones`).toBeGreaterThan(0);
          const bad = checkExportReadiness(template).issues.filter((issue) => NOT_CUTTABLE.has(issue.code));
          expect(bad.map((issue) => issue.code), `${fontSizeMm} mm`).toEqual([]);

          // Independent of the readiness check: no two stones closer than the material's minimum centre distance.
          const hole = getRecommendedHoleDiameter('SS10');
          const minimum = getMinimumCenterDistance(hole / 2, hole / 2);
          const stones = template.stones;
          let closest = Infinity;
          for (let i = 0; i < stones.length; i++) {
            for (let j = i + 1; j < stones.length; j++) {
              closest = Math.min(closest, Math.hypot(stones[i]!.center.x - stones[j]!.center.x, stones[i]!.center.y - stones[j]!.center.y));
            }
          }
          expect(closest, `${fontSizeMm} mm closest pair`).toBeGreaterThanOrEqual(minimum - 1e-6);
        }
      });
    }
  }

  it('is deterministic: the same text gives the same stones', async () => {
    const make = () =>
      createOutlineTextTemplateAsync({ id: 'a', name: 'a', text: 'Mia', stoneSize: 'SS10', fontId: 'archivo-black', fontSizeMm: 45, coverageMode: 'fill', fillMode: 'fill' });
    const a = await make();
    const b = await make();
    expect(a.stones.map((s) => [s.center.x, s.center.y])).toEqual(b.stones.map((s) => [s.center.x, s.center.y]));
  });

  it('solid fills the inside of letters that are wide enough (the old fill left scattered stones)', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 'solid', name: 'solid', text: 'OH', stoneSize: 'SS10', fontId: 'archivo-black', fontSizeMm: 60, coverageMode: 'fill', fillMode: 'fill',
    });
    const fill = template.stones.filter((stone) => stone.metadata?.collisionSource === 'fill').length;
    const edge = template.stones.length - fill;
    expect(fill).toBeGreaterThan(0);
    expect(edge).toBeGreaterThan(0);
  });
});
