import { describe, expect, it } from 'vitest';
import { curateLetterAssets } from '@/src/lib/rhinestone-engine/assetLibrary/letterAssetCuration';
import type { LetterAssetPackageSummary } from '@/src/lib/rhinestone-engine/assetLibrary/letterAssetCatalog';

function pkg(overrides: Partial<LetterAssetPackageSummary> = {}): LetterAssetPackageSummary {
  return {
    sourceRootName: 'FONT GENERATED CHATGPT',
    packageName: 'F1-Forever-ALPHABET',
    locationKind: 'directory',
    canonicalName: 'F1 Forever ALPHABET',
    duplicateKey: 'f1 forever alphabet',
    suggestedId: 'f1-forever-alphabet',
    assetKinds: ['rhinestone-font', 'svg-alphabet'],
    supportedStoneSizes: ['SS6', 'SS10'],
    containsOpenType: true,
    containsSvg: true,
    relativePaths: ['Font/font.otf', 'Svg/A.svg'],
    notes: [],
    ...overrides,
  };
}

describe('letter asset curation', () => {
  it('marks directory packages with usable source assets as candidates', () => {
    const manifest = curateLetterAssets([pkg()]);

    expect(manifest.summary).toEqual({
      candidateCount: 1,
      duplicateArchiveCount: 0,
      reviewCount: 0,
    });
    expect(manifest.entries[0]?.status).toBe('candidate');
    expect(manifest.entries[0]?.recommendedKinds).toEqual(['rhinestone-font', 'svg-alphabet']);
  });

  it('demotes archive duplicates when a directory package exists', () => {
    const manifest = curateLetterAssets([
      pkg(),
      pkg({
        packageName: 'F1-Forever-ALPHABET.zip',
        locationKind: 'archive',
        containsOpenType: false,
        containsSvg: false,
        assetKinds: ['archive-only'],
        relativePaths: ['Font/font.otf', 'Svg/A.svg'],
      }),
    ]);

    expect(manifest.summary.duplicateArchiveCount).toBe(1);
    expect(manifest.entries.find((entry) => entry.packageName.endsWith('.zip'))?.status).toBe('duplicate-archive');
  });

  it('keeps unresolved packages in review', () => {
    const manifest = curateLetterAssets([
      pkg({
        packageName: 'F99-Mystery',
        duplicateKey: 'f99 mystery',
        suggestedId: 'f99-mystery',
        containsOpenType: false,
        containsSvg: false,
        assetKinds: ['unknown'],
        supportedStoneSizes: [],
        relativePaths: ['preview.jpg'],
        notes: ['Package needs manual review.'],
      }),
    ]);

    expect(manifest.summary.reviewCount).toBe(1);
    expect(manifest.entries[0]?.status).toBe('review');
  });
});