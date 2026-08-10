/**
 * Rhinestone Font Registry
 *
 * Fonts where glyphs are composed of pre-placed rhinestone shapes.
 * These are NOT regular outline fonts — each glyph contains discrete stone contours.
 */

import type { StoneSizeId } from '../types/index';

export type RhinestoneFontId =
  | 'trw-clean-stone'
  | 'cheer-block'
  | 'forever-script'
  | 'blessed-stone'
  | 'outline-stone'
  | 'small-line-font'
  | 'atletico-real'
  | 'bride-script'
  | 'huge-digits'
  | 'old-english-stone'
  | 'test-fixture';

export type RhinestoneFontCategory = 'Private' | 'Library' | 'Fixture';
export type RhinestoneFontStyle = 'Block' | 'Varsity' | 'Bubble' | 'Script' | 'Line' | 'Digits' | 'Gothic' | 'Monogram' | 'Retro';

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
  supportedTargetStoneSizeIds: readonly StoneSizeId[];
  license: string;
  licenseSource: string;
  isPrivate: boolean;
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
    suggestedText: 'SULAY',
    fontFamily: 'TRW Clean Stone',
    previewFontFamily: 'RhinestoneTRWCleanStone',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('trw-clean-stone'),
    nodeFilePath: 'public/fonts/rhinestone/TRW-Clean-Stone.otf',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'Private / Non-distributable',
    licenseSource: 'Private user asset for personal use only',
    isPrivate: true,
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
    fontId: 'blessed-stone',
    displayName: 'Blessed',
    category: 'Library',
    style: 'Script',
    suggestedText: 'Blessed',
    fontFamily: 'Rhinestone Blessed',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('blessed-stone'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-Blessed-SS6-SS10/Rhinestone-Blessed-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-Blessed-SS6-SS10/Rhinestone-Blessed-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-Blessed-SS6-SS10',
    isPrivate: true,
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
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F1-Forever-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: true,
      swedish: false,
    },
  },
  {
    fontId: 'cheer-block',
    displayName: 'Cheer Block',
    category: 'Library',
    style: 'Block',
    suggestedText: 'CHEER',
    fontFamily: 'Rhinestone Cheer Block',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('cheer-block'),
    nodeFilePath: null,
    libraryRelativePath: 'FONT GENERATED CHATGPT/F2-Cheer-ALPHABET/CHEER-SS6-SS10-C/Font/RS02 AW Atletico Bold.otf',
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F2-Cheer-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
  },
  {
    fontId: 'outline-stone',
    displayName: 'Outline',
    category: 'Library',
    style: 'Block',
    suggestedText: 'OUTLINE',
    fontFamily: 'Rhinestone Outline',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('outline-stone'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F16-Outline-SS6-SS10/Rhinestone-F16-Outline-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F16-Outline-SS6-SS10/Rhinestone-F16-Outline-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-F16-Outline-SS6-SS10',
    isPrivate: true,
  },
  {
    fontId: 'small-line-font',
    displayName: 'Small Line',
    category: 'Library',
    style: 'Line',
    suggestedText: 'SMALL',
    fontFamily: 'Rhinestone Small Line',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('small-line-font'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F26-Small-Line-SS6-SS10/Rhinestone-F26-Small-Line-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F26-Small-Line-SS6-SS10/Rhinestone-F26-Small-Line-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-F26-Small-Line-SS6-SS10',
    isPrivate: true,
  },
  {
    fontId: 'atletico-real',
    displayName: 'Atletico Real',
    category: 'Library',
    style: 'Block',
    suggestedText: 'REAL2026',
    fontFamily: 'Rhinestone Real',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('atletico-real'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F4-Real-SS6-SS10/Rhinestone-F4-Real-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F4-Real-SS6-SS10/Rhinestone-F4-Real-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-F4-F5-F7-font-packages',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
  },
  {
    fontId: 'bride-script',
    displayName: 'Bride',
    category: 'Library',
    style: 'Script',
    suggestedText: 'Bride',
    fontFamily: 'Rhinestone Bride',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('bride-script'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F5-Bride-SS6-SS10/Rhinestone-F5-Bride-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F5-Bride-SS6-SS10/Rhinestone-F5-Bride-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-F4-F5-F7-font-packages',
    isPrivate: true,
  },
  {
    fontId: 'huge-digits',
    displayName: 'Huge Digits',
    category: 'Library',
    style: 'Digits',
    suggestedText: '2026',
    fontFamily: 'Rhinestone Huge Digits',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('huge-digits'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F7-Huge-Numbers-SS6-SS10/Rhinestone-F7-Huge-Numbers-SS6.otf',
      SS10: 'Rhinsestont font library/Rhinestone-F4-F5-F7-font-packages/Rhinestone-F7-Huge-Numbers-SS6-SS10/Rhinestone-F7-Huge-Numbers-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-F4-F5-F7-font-packages',
    isPrivate: true,
    characterCoverage: {
      uppercase: false,
      lowercase: false,
      digits: true,
      swedish: false,
    },
  },
  {
    fontId: 'old-english-stone',
    displayName: 'Old English',
    category: 'Library',
    style: 'Gothic',
    suggestedText: 'OLD',
    fontFamily: 'Rhinestone Old English',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('old-english-stone'),
    nodeFilePath: null,
    libraryRelativePathBySize: {
      SS6: 'Rhinsestont font library/Rhinestone-Old-English-SS6-SS10/Rhinestone-Old-English-SS06.otf',
      SS10: 'Rhinsestont font library/Rhinestone-Old-English-SS6-SS10/Rhinestone-Old-English-SS10.otf',
    },
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinsestont font library / Rhinestone-Old-English-SS6-SS10',
    isPrivate: true,
  },
  {
    fontId: 'test-fixture',
    displayName: 'Test Fixture Font',
    category: 'Fixture',
    style: 'Block',
    suggestedText: 'ABS',
    fontFamily: 'Test Fixture Rhinestone',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: null,
    nodeFilePath: 'tests/fixtures/fonts/test-rhinestone-font.otf',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'Test fixture only',
    licenseSource: 'Generated for testing purposes',
    isPrivate: false,
    limitations: ['Test use only', 'Contains A, B, S with simple circular contours'],
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: false,
      swedish: false,
    },
  },
];

const FONT_MAP = new Map(RHINESTONE_FONT_REGISTRY.map((font) => [font.fontId, font]));

export function getRhinestoneFontDefinition(fontId: RhinestoneFontId): RhinestoneFontDefinition {
  const def = FONT_MAP.get(fontId);
  if (!def) {
    throw new Error(`Unknown rhinestone font ID: ${fontId}`);
  }
  return def;
}

export function getRhinestoneFontStyle(fontId: string | undefined | null): RhinestoneFontStyle {
  const resolvedId = isKnownRhinestoneFontId(fontId) ? fontId : DEFAULT_RHINESTONE_FONT_ID;
  return getRhinestoneFontDefinition(resolvedId).style;
}

export function getSupportedRhinestoneFontStoneSizes(fontId: string | undefined | null): readonly StoneSizeId[] {
  const resolvedId = isKnownRhinestoneFontId(fontId) ? fontId : DEFAULT_RHINESTONE_FONT_ID;
  return getRhinestoneFontDefinition(resolvedId).supportedTargetStoneSizeIds;
}

export function getPreferredRhinestoneFontStoneSize(fontId: string | undefined | null): StoneSizeId {
  const supported = getSupportedRhinestoneFontStoneSizes(fontId);
  return supported.includes('SS10') ? 'SS10' : supported[0] ?? 'SS10';
}

export function isKnownRhinestoneFontId(fontId: string | undefined | null): fontId is RhinestoneFontId {
  return typeof fontId === 'string' && FONT_MAP.has(fontId as RhinestoneFontId);
}

/**
 * Fonts the production font picker should never show — test-only fixtures
 * whose backing asset (e.g. a file under tests/fixtures/) doesn't exist
 * outside the test run.
 */
const NON_PRODUCTION_CATEGORIES: ReadonlySet<RhinestoneFontDefinition['category']> = new Set(['Fixture']);

export function listRhinestoneFonts(): readonly RhinestoneFontDefinition[] {
  return RHINESTONE_FONT_REGISTRY.filter((font) => !NON_PRODUCTION_CATEGORIES.has(font.category));
}
