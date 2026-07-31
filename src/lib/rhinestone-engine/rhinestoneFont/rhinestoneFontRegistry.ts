/**
 * Rhinestone Font Registry
 *
 * Fonts where the glyphs are composed of pre-placed rhinestone shapes.
 * These are NOT regular outline fonts — each glyph contains discrete stone contours
 * that are extracted as individual stones, not regenerated through fill algorithms.
 *
 * TRW Clean Stone is a private font asset and must not be distributed.
 */

import type { StoneSizeId } from '../types/index';

export type RhinestoneFontId =
  | 'trw-clean-stone'
  | 'test-fixture'
  | 'blessed-ss10'
  | 'bride-ss10'
  | 'real-ss10'
  | 'old-english-ss10'
  | 'outline-ss10'
  | 'small-line-ss10'
  | 'huge-numbers-ss10'
  | 'forever-script'
  | 'atletico-varsity';

export type RhinestoneFontCategory = 'Private' | 'Fixture' | 'Library';
export type RhinestoneFontStyle = 'Script' | 'Block' | 'Outline' | 'Line' | 'Digits' | 'Gothic';

export interface RhinestoneFontDefinition {
  fontId: RhinestoneFontId;
  displayName: string;
  category: RhinestoneFontCategory;
  style: RhinestoneFontStyle;
  suggestedText: string;
  fontFamily: string;
  previewFontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  assetUrl: string | null;
  nodeFilePath: string | null;
  libraryRelativePath?: string;
  libraryRelativePathBySize?: Partial<Record<StoneSizeId, string>>;
  license: string;
  licenseSource: string;
  isPrivate: boolean;
  supportedTargetStoneSizeIds: readonly StoneSizeId[];
  limitations?: string[];
  characterCoverage?: {
    uppercase: boolean;
    lowercase: boolean;
    digits: boolean;
    swedish: boolean;
  };
}

export const TRW_CLEAN_STONE_FONT_ID: RhinestoneFontId = 'trw-clean-stone';
export const DEFAULT_RHINESTONE_FONT_ID: RhinestoneFontId = TRW_CLEAN_STONE_FONT_ID;

function localRhinestoneFontAssetUrl(fontId: RhinestoneFontId): string {
  return `/api/rhinestone-fonts/${fontId}`;
}

export const RHINESTONE_FONT_REGISTRY: readonly RhinestoneFontDefinition[] = [
  {
    fontId: 'trw-clean-stone',
    displayName: 'TRW Clean Stone',
    category: 'Private',
    style: 'Script',
    suggestedText: 'Sulay',
    fontFamily: 'TRW Clean Stone',
    previewFontFamily: 'RhinestoneTRWCleanStone',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('trw-clean-stone'),
    nodeFilePath: 'public/fonts/rhinestone/TRW-Clean-Stone.otf',
    license: 'Private / Non-distributable',
    licenseSource: 'Private user asset for personal use only',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS6', 'SS10', 'SS16', 'SS20'],
    limitations: [
      'A–Z and a–z only',
      'No digits',
      'No Swedish characters (Å Ä Ö å ä ö)',
      'No kerning',
      'Fixed character widths',
    ],
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: false,
      swedish: false,
    },
  },
  {
    fontId: 'test-fixture',
    displayName: 'Test Fixture Font',
    category: 'Fixture',
    style: 'Outline',
    suggestedText: 'ABS',
    fontFamily: 'Test Fixture Rhinestone',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: null,
    nodeFilePath: 'tests/fixtures/fonts/test-rhinestone-font.otf',
    license: 'Test fixture only',
    licenseSource: 'Generated for testing purposes',
    isPrivate: false,
    supportedTargetStoneSizeIds: ['SS10'],
    limitations: ['Test use only', 'Contains A, B, S with simple circular contours'],
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: false,
      swedish: false,
    },
  },
  {
    fontId: 'blessed-ss10',
    displayName: 'Blessed',
    category: 'Library',
    style: 'Script',
    suggestedText: 'Blessed',
    fontFamily: 'Rhinestone Blessed SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('blessed-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-Blessed-SS6-SS10/Rhinestone-Blessed-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-Blessed-SS6-SS10/Rhinestone-Blessed-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-Blessed-SS6-SS10/Rhinestone-Blessed-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Sized for SS6/SS10 packages', 'Coverage depends on bundled asset'],
  },
  {
    fontId: 'bride-ss10',
    displayName: 'Bride',
    category: 'Library',
    style: 'Script',
    suggestedText: 'Bride',
    fontFamily: 'Rhinestone Bride SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('bride-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F5-Bride-SS6-SS10/Rhinestone-F5-Bride-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F5-Bride-SS6-SS10/Rhinestone-F5-Bride-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F5-Bride-SS6-SS10/Rhinestone-F5-Bride-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Sized for SS6/SS10 packages', 'Coverage depends on bundled asset'],
  },
  {
    fontId: 'real-ss10',
    displayName: 'Real',
    category: 'Library',
    style: 'Block',
    suggestedText: 'REAL2026',
    fontFamily: 'Rhinestone Real SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('real-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F4-Real-SS6-SS10/Rhinestone-F4-Real-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F4-Real-SS6-SS10/Rhinestone-F4-Real-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F4-Real-SS6-SS10/Rhinestone-F4-Real-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Sized for SS6/SS10 packages', 'Coverage depends on bundled asset'],
  },
  {
    fontId: 'old-english-ss10',
    displayName: 'Old English',
    category: 'Library',
    style: 'Gothic',
    suggestedText: 'Bride',
    fontFamily: 'Rhinestone Old English SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('old-english-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-Old-English-SS6-SS10/Rhinestone-Old-English-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-Old-English-SS6-SS10/Rhinestone-Old-English-SS06.otf',
      SS10: 'Rhinsestont font library/Rhinestone-Old-English-SS6-SS10/Rhinestone-Old-English-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Sized for SS6/SS10 packages', 'Coverage depends on bundled asset'],
  },
  {
    fontId: 'outline-ss10',
    displayName: 'Outline',
    category: 'Library',
    style: 'Outline',
    suggestedText: 'OUTLINE',
    fontFamily: 'Rhinestone Outline SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('outline-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-F16-Outline-SS6-SS10/Rhinestone-F16-Outline-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F16-Outline-SS6-SS10/Rhinestone-F16-Outline-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F16-Outline-SS6-SS10/Rhinestone-F16-Outline-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Sized for SS6/SS10 packages', 'Coverage depends on bundled asset'],
  },
  {
    fontId: 'small-line-ss10',
    displayName: 'Small Line',
    category: 'Library',
    style: 'Line',
    suggestedText: 'CHEER',
    fontFamily: 'Rhinestone Small Line SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('small-line-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-F26-Small-Line-SS6-SS10/Rhinestone-F26-Small-Line-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F26-Small-Line-SS6-SS10/Rhinestone-F26-Small-Line-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F26-Small-Line-SS6-SS10/Rhinestone-F26-Small-Line-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Sized for SS6/SS10 packages', 'Coverage depends on bundled asset'],
  },
  {
    fontId: 'huge-numbers-ss10',
    displayName: 'Huge Numbers',
    category: 'Library',
    style: 'Digits',
    suggestedText: '2026',
    fontFamily: 'Rhinestone Huge Numbers SS10',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('huge-numbers-ss10'),
    nodeFilePath: null,
    libraryRelativePath: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F7-Huge-Numbers-SS6-SS10/Rhinestone-F7-Huge-Numbers-SS10.otf',
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F7-Huge-Numbers-SS6-SS10/Rhinestone-F7-Huge-Numbers-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F7-Huge-Numbers-SS6-SS10/Rhinestone-F7-Huge-Numbers-SS10.otf',
    },
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Digits-focused package', 'Sized for SS6/SS10 packages'],
    characterCoverage: {
      uppercase: false,
      lowercase: false,
      digits: true,
      swedish: false,
    },
  },
  {
    fontId: 'forever-script',
    displayName: 'Forever',
    category: 'Library',
    style: 'Script',
    suggestedText: 'Forever',
    fontFamily: 'Rhinestone Forever',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('forever-script'),
    nodeFilePath: null,
    libraryRelativePath: 'FONT GENERATED CHATGPT/F1-Forever-ALPHABET/F1-Rhinestone-Forever-SS06-SS10/Forever.otf',
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Single OTF sized for SS6/SS10 targets', 'Auto-scaled per requested stone size'],
  },
  {
    fontId: 'atletico-varsity',
    displayName: 'Atletico Bold',
    category: 'Library',
    style: 'Block',
    suggestedText: 'CHEER',
    fontFamily: 'RS02 AW Atletico Bold',
    previewFontFamily: 'system-ui',
    fontWeight: 700,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('atletico-varsity'),
    nodeFilePath: null,
    libraryRelativePath: 'FONT GENERATED CHATGPT/F2-Cheer-ALPHABET/CHEER-SS6-SS10-C/Font/RS02 AW Atletico Bold.otf',
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library (F2 Cheer + F4 Real packages)',
    isPrivate: true,
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    limitations: ['Single OTF used across multiple F-packages', 'Auto-scaled per requested stone size'],
  },
];

export function getRhinestoneFontDefinition(fontId: RhinestoneFontId): RhinestoneFontDefinition {
  const def = RHINESTONE_FONT_REGISTRY.find((f) => f.fontId === fontId);
  if (!def) {
    throw new Error(`Unknown rhinestone font ID: ${fontId}`);
  }
  return def;
}

export function isKnownRhinestoneFontId(fontId: string | undefined | null): fontId is RhinestoneFontId {
  if (!fontId) return false;
  return RHINESTONE_FONT_REGISTRY.some((f) => f.fontId === fontId);
}

export function listRhinestoneFonts(): readonly RhinestoneFontDefinition[] {
  return RHINESTONE_FONT_REGISTRY;
}

export function getSupportedRhinestoneFontStoneSizes(fontId: string | undefined | null): readonly StoneSizeId[] {
  return getRhinestoneFontDefinition(isKnownRhinestoneFontId(fontId) ? fontId : DEFAULT_RHINESTONE_FONT_ID).supportedTargetStoneSizeIds;
}

export function getPreferredRhinestoneFontStoneSize(fontId: string | undefined | null): StoneSizeId {
  return getSupportedRhinestoneFontStoneSizes(fontId)[0] ?? 'SS10';
}

export function getRhinestoneFontStyle(fontId: string | undefined | null): RhinestoneFontStyle {
  return getRhinestoneFontDefinition(isKnownRhinestoneFontId(fontId) ? fontId : DEFAULT_RHINESTONE_FONT_ID).style;
}
