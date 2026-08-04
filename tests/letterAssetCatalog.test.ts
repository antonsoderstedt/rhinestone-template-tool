import { describe, expect, it } from 'vitest';
import {
  groupDuplicateLetterAssets,
  normalizeLetterAssetPackageName,
  summarizeLetterAssetPackage,
} from '@/src/lib/rhinestone-engine/assetLibrary/letterAssetCatalog';

describe('letter asset catalog', () => {
  it('normalizes copied archive names into the same duplicate key', () => {
    expect(normalizeLetterAssetPackageName('Rhinestone-Blessed-SS6-SS10.zip')).toBe('rhinestone blessed ss6 ss10');
    expect(normalizeLetterAssetPackageName('Rhinestone-Blessed-SS6-SS10 (1).zip')).toBe('rhinestone blessed ss6 ss10');
  });

  it('summarizes mixed font and svg packages with inferred stone sizes', () => {
    const summary = summarizeLetterAssetPackage({
      sourceRootName: 'FONT GENERATED CHATGPT',
      packageName: 'F4-REAL-ALPHABET',
      locationKind: 'directory',
      relativePaths: [
        'RS02 AW Atletico Bold.otf',
        'SVG/SVG_Alphabet02_ss10_uppercase_1.svg',
        'SVG/SVG_Alphabet02_ss6_lowercase.svg',
      ],
    });

    expect(summary.canonicalName).toBe('F4 REAL ALPHABET');
    expect(summary.suggestedId).toBe('f4-real-alphabet');
    expect(summary.containsOpenType).toBe(true);
    expect(summary.containsSvg).toBe(true);
    expect(summary.assetKinds).toEqual(['rhinestone-font', 'svg-alphabet']);
    expect(summary.supportedStoneSizes).toEqual(['SS6', 'SS10']);
    expect(summary.notes).toEqual([]);
  });

  it('marks uninspected archives for manual review while still grouping duplicates', () => {
    const folder = summarizeLetterAssetPackage({
      sourceRootName: 'Rhinsestont font library',
      packageName: 'Rhinestone-Blessed-SS6-SS10',
      locationKind: 'directory',
      relativePaths: ['Blessed SS10.otf', 'Blessed SS6.otf'],
    });
    const archive = summarizeLetterAssetPackage({
      sourceRootName: 'Rhinsestont font library',
      packageName: 'Rhinestone-Blessed-SS6-SS10.zip',
      locationKind: 'archive',
      relativePaths: [],
    });
    const copiedArchive = summarizeLetterAssetPackage({
      sourceRootName: 'Rhinsestont font library',
      packageName: 'Rhinestone-Blessed-SS6-SS10 (1).zip',
      locationKind: 'archive',
      relativePaths: [],
    });

    expect(archive.assetKinds).toEqual(['archive-only']);
  expect(archive.supportedStoneSizes).toEqual(['SS6', 'SS10']);
    expect(archive.notes).toContain('Archive not inspected; classification is based on the archive name only.');

    const groups = groupDuplicateLetterAssets([folder, archive, copiedArchive]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.duplicateKey).toBe('rhinestone blessed ss6 ss10');
    expect(groups[0]?.packages).toHaveLength(3);
  });
});