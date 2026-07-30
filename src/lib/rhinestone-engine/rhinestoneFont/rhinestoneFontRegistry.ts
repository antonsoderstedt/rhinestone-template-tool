/**
 * Rhinestone Font Registry
 *
 * Fonts where the glyphs are composed of pre-placed rhinestone shapes.
 * These are NOT regular outline fonts — each glyph contains discrete stone contours
 * that are extracted as individual stones, not regenerated through fill algorithms.
 *
 * TRW Clean Stone is a private font asset and must not be distributed.
 */

export type RhinestoneFontId = 'trw-clean-stone' | 'test-fixture';

export type RhinestoneFontCategory = 'Private' | 'Fixture';

export interface RhinestoneFontDefinition {
  fontId: RhinestoneFontId;
  displayName: string;
  category: RhinestoneFontCategory;
  fontFamily: string;
  previewFontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  assetUrl: string | null;
  nodeFilePath: string | null;
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
    fontFamily: 'TRW Clean Stone',
    previewFontFamily: 'RhinestoneTRWCleanStone',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localRhinestoneFontAssetUrl('trw-clean-stone'),
    nodeFilePath: 'public/fonts/rhinestone/TRW-Clean-Stone.otf',
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
    fontId: 'test-fixture',
    displayName: 'Test Fixture Font',
    category: 'Fixture',
    fontFamily: 'Test Fixture Rhinestone',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: null,
    nodeFilePath: 'tests/fixtures/fonts/test-rhinestone-font.otf',
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
