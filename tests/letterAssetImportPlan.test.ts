import { describe, expect, it } from 'vitest';
import { buildLetterAssetImportPlan } from '@/src/lib/rhinestone-engine/assetLibrary/letterAssetImportPlan';
import type { LetterAssetCurationEntry } from '@/src/lib/rhinestone-engine/assetLibrary/letterAssetCuration';

function candidate(packageName: string): LetterAssetCurationEntry {
  return {
    packageName,
    sourceRootName: 'FONT GENERATED CHATGPT',
    suggestedId: packageName.toLowerCase(),
    status: 'candidate',
    canonicalPackageName: packageName,
    recommendedKinds: ['rhinestone-font', 'svg-alphabet'],
    reason: 'Contains source assets that are usable for registry curation.',
    notes: [],
  };
}

describe('letter asset import plan', () => {
  it('proposes missing first-batch font and alphabet entries from curation candidates', () => {
    const plan = buildLetterAssetImportPlan(
      [candidate('F4-REAL-ALPHABET'), candidate('F2-Cheer-ALPHABET')],
      ['trw-clean-stone'],
      ['scoreboard-block'],
      [
        { packageName: 'F4-REAL-ALPHABET', anyFontFileCount: 1, directFontFileCount: 1, directSvgFileCount: 1, directGlyphSvgFileCount: 0 },
        { packageName: 'F2-Cheer-ALPHABET', anyFontFileCount: 0, directFontFileCount: 0, directSvgFileCount: 0, directGlyphSvgFileCount: 0 },
      ],
    );

    expect(plan.summary).toEqual({
      rhinestoneFontCount: 1,
      svgAlphabetCount: 2,
    });
    expect(plan.entries.map((entry) => `${entry.priority}:${entry.readiness}:${entry.proposedId}`)).toEqual([
      'now:ready:atletico-real',
      'now:blocked:cheer-block',
      'now:blocked:real-college',
    ]);
    expect(plan.entries.find((entry) => entry.proposedId === 'atletico-real')?.blockedReason).toBeUndefined();
    expect(plan.entries.find((entry) => entry.proposedId === 'real-college')?.blockedReason).toBe('combined-svg-strip');
  });

  it('skips entries that already exist in the corresponding registry', () => {
    const plan = buildLetterAssetImportPlan(
      [candidate('F2-Cheer-ALPHABET')],
      ['cheer-block'],
      ['cheer-block'],
    );

    expect(plan.entries).toEqual([]);
    expect(plan.summary).toEqual({
      rhinestoneFontCount: 0,
      svgAlphabetCount: 0,
    });
  });

  it('ignores non-candidate curation entries', () => {
    const plan = buildLetterAssetImportPlan(
      [{ ...candidate('F4-REAL-ALPHABET'), status: 'duplicate-archive' }],
      [],
      [],
      [{ packageName: 'F4-REAL-ALPHABET', anyFontFileCount: 1, directFontFileCount: 1, directSvgFileCount: 1, directGlyphSvgFileCount: 0 }],
    );

    expect(plan.entries).toEqual([]);
  });

  it('drops impossible font proposals when the scanned package has no font files at all', () => {
    const plan = buildLetterAssetImportPlan(
      [candidate('F11-Big-Bold-ALPHABET')],
      [],
      [],
      [{ packageName: 'F11-Big-Bold-ALPHABET', anyFontFileCount: 0, directFontFileCount: 0, directSvgFileCount: 1, directGlyphSvgFileCount: 1 }],
    );

    expect(plan.entries).toEqual([
      expect.objectContaining({
        target: 'svg-alphabet',
        proposedId: 'big-bold',
      }),
    ]);
  });
});