/**
 * SVG Alphabet Registry
 *
 * Registered alphabets whose individual letter glyphs are stored as per-character
 * SVG files (each SVG made of native <circle> stones). Each alphabet package ships
 * one SVG per supported character in a folder, e.g. F28 Scoreboard: A.svg, B.svg,
 * ... 9.svg.
 *
 * Alphabets are user-provided local assets under ~/Desktop/LETTER UTVALDA/ and
 * are not distributable.
 */

import type { StoneSizeId } from '../types/index';

export type SvgAlphabetCharacterClass = 'uppercase' | 'lowercase' | 'digits';

export interface SvgAlphabetCombinedSource {
  characters: string;
  libraryRelativeFile: string;
  targetStoneSizeId?: StoneSizeId;
  groupMergeMargin: number;
}

export type SvgAlphabetId =
  | 'big-bold'
  | 'blessed-script'
  | 'broadway-retro'
  | 'bride-script'
  | 'cheer-block'
  | 'disney-script'
  | 'huge-digits'
  | 'line-font'
  | 'college-varsity'
  | 'forever-script'
  | 'real-college'
  | 'scoreboard-block'
  | 'toys-bubble'
  | 'birthday-script'
  | 'retro-wide'
  | 'varsity-collage-a'
  | 'old-english-gothic';

export type SvgAlphabetCategory = 'Library';
export type SvgAlphabetStyle = 'Block' | 'Varsity' | 'Bubble' | 'Script' | 'Line' | 'Digits' | 'Retro' | 'Gothic';

export interface SvgAlphabetDefinition {
  alphabetId: SvgAlphabetId;
  displayName: string;
  category: SvgAlphabetCategory;
  style: SvgAlphabetStyle;
  suggestedText: string;
  /** Directory containing per-letter SVG files, relative to a library root. */
  libraryRelativeDir: string;
  /** Optional per-size directory overrides (used when the package ships SS6 and SS10 in separate folders). */
  libraryRelativeDirBySize?: Partial<Record<StoneSizeId, string>>;
  /** Optional per-character-class directories when uppercase/lowercase/digits live in separate folders. */
  libraryRelativeDirByCharacterClass?: Partial<Record<SvgAlphabetCharacterClass, string>>;
  /**
   * Optional per-size, per-character-class directories, for packages that
   * split by both size AND case (e.g. SS06-UPPERCASE, SS06-LOWERCASE,
   * SS10-UPPERCASE, SS10-LOWERCASE). Takes priority over both
   * `libraryRelativeDirBySize` and `libraryRelativeDirByCharacterClass`.
   */
  libraryRelativeDirBySizeAndCharacterClass?: Partial<Record<StoneSizeId, Partial<Record<SvgAlphabetCharacterClass, string>>>>;
  /** Optional combined strip files that must be split into per-character glyphs server-side. */
  combinedSources?: readonly SvgAlphabetCombinedSource[];
  /**
   * Optional per-character glyph file basename fallbacks, tried when the
   * primary `<character><glyphExtension>` file does not exist (e.g. a source
   * package that named its i-glyph with a dotless ı).
   */
  glyphFileFallbackByChar?: Readonly<Record<string, string>>;
  /**
   * Optional typographic baseline metrics: fraction of each glyph's own height
   * that hangs below the text baseline (0 = bottom sits on the baseline,
   * negative = bottom floats above it, e.g. a shortened z). Characters not
   * listed sit on the baseline. When present, generators align glyphs to a
   * shared baseline using these exact fractions instead of heuristics.
   */
  baselineBelowFractionByChar?: Readonly<Record<string, number>>;
  /** File extension for each glyph SVG (usually '.svg'). */
  glyphExtension: string;
  /** Native stone size the alphabet was authored for. */
  authoredStoneSizeId: StoneSizeId;
  supportedTargetStoneSizeIds: readonly StoneSizeId[];
  license: string;
  licenseSource: string;
  isPrivate: boolean;
  characterCoverage: {
    uppercase: boolean;
    lowercase: boolean;
    digits: boolean;
    swedish: boolean;
  };
  limitations?: string[];
}

export const DEFAULT_SVG_ALPHABET_ID: SvgAlphabetId = 'scoreboard-block';

export const SVG_ALPHABET_REGISTRY: readonly SvgAlphabetDefinition[] = [
  {
    alphabetId: 'big-bold',
    displayName: 'Big Bold',
    category: 'Library',
    style: 'Block',
    suggestedText: 'BOLD',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F11-Big-Bold-ALPHABET/F11-bold-rhinestone-font.zip/SVG',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F11-Big-Bold-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Uppercase and digits only', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'blessed-script',
    displayName: 'Blessed',
    category: 'Library',
    style: 'Script',
    suggestedText: 'BLESSED',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/Done/F3-Blessed-ALPHABET/F3-rhinestone-Blessed-ss6-ss10.zip/Blessed-SS10/SVG-Alphabet/SVG-Uppercase',
    libraryRelativeDirByCharacterClass: {
      uppercase: 'FONT GENERATED CHATGPT/Done/F3-Blessed-ALPHABET/F3-rhinestone-Blessed-ss6-ss10.zip/Blessed-SS10/SVG-Alphabet/SVG-Uppercase',
      lowercase: 'FONT GENERATED CHATGPT/Done/F3-Blessed-ALPHABET/F3-rhinestone-Blessed-ss6-ss10.zip/Blessed-SS10/SVG-Alphabet/SVG-lowercase',
      digits: 'FONT GENERATED CHATGPT/Done/F3-Blessed-ALPHABET/F3-rhinestone-Blessed-ss6-ss10.zip/Blessed-SS10/SVG-Alphabet/SVG-Digits-Numbers',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / Done / F3-Blessed-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: true,
      swedish: false,
    },
    limitations: ['SS10 only in the current registry', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'broadway-retro',
    displayName: 'Broadway',
    category: 'Library',
    style: 'Retro',
    suggestedText: 'BROADWAY',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F12-BRODWAY-ALPHABET/F12-FONT-BRODWAYSS6-SS10.zip/SS10/SVG',
    libraryRelativeDirByCharacterClass: {
      uppercase: 'TEXT FONT TEMPLATE/F12-BRODWAY-ALPHABET/F12-FONT-BRODWAYSS6-SS10.zip/SS10/SVG',
      lowercase: 'TEXT FONT TEMPLATE/F12-BRODWAY-ALPHABET/F12-FONT-BRODWAYSS6-SS10.zip/SS10/lowercase/svg',
      digits: 'TEXT FONT TEMPLATE/F12-BRODWAY-ALPHABET/F12-FONT-BRODWAYSS6-SS10.zip/SS10/SVG',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / TEXT FONT TEMPLATE / F12-BRODWAY-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: true,
      swedish: false,
    },
    limitations: ['SS10 only in the current registry', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'bride-script',
    displayName: 'Bride',
    category: 'Library',
    style: 'Script',
    suggestedText: 'BRIDE',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F5-Bride-ALPHABET/F5-Bride-font-SS10.zip/Bride-SVG/SVG-UPPERCASE',
    libraryRelativeDirByCharacterClass: {
      uppercase: 'FONT GENERATED CHATGPT/F5-Bride-ALPHABET/F5-Bride-font-SS10.zip/Bride-SVG/SVG-UPPERCASE',
      lowercase: 'FONT GENERATED CHATGPT/F5-Bride-ALPHABET/F5-Bride-font-SS10.zip/Bride-SVG/SVG-Lowercase',
      digits: 'FONT GENERATED CHATGPT/F5-Bride-ALPHABET/F5-Bride-font-SS10.zip/Bride-SVG/SVG-DIGITS',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F5-Bride-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: true,
      swedish: false,
    },
    limitations: ['SS10 only in the current registry', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'cheer-block',
    displayName: 'Cheer Block',
    category: 'Library',
    style: 'Block',
    suggestedText: 'CHEER 24',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F2-Cheer-ALPHABET/CHEER-SS6-SS10-C/SS10/Svg',
    libraryRelativeDirBySize: {
      SS6: 'FONT GENERATED CHATGPT/F2-Cheer-ALPHABET/CHEER-SS6-SS10-C/SS06/svg',
      SS10: 'FONT GENERATED CHATGPT/F2-Cheer-ALPHABET/CHEER-SS6-SS10-C/SS10/Svg',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
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
    limitations: ['Uppercase and digits only'],
  },
  {
    alphabetId: 'disney-script',
    displayName: 'Disney Script',
    category: 'Library',
    style: 'Script',
    suggestedText: 'MAGIC',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F18-DISNEY-ALPHABET/F18-PRINCESS-ALPHABET.zip/BORDER-OUTLINE/SVG',
    libraryRelativeDirByCharacterClass: {
      uppercase: 'TEXT FONT TEMPLATE/F18-DISNEY-ALPHABET/F18-PRINCESS-ALPHABET.zip/BORDER-OUTLINE/SVG',
      lowercase: 'TEXT FONT TEMPLATE/F18-DISNEY-ALPHABET/F18-PRINCESS-ALPHABET.zip/BORDER-OUTLINE/lowercase/svg',
      digits: 'TEXT FONT TEMPLATE/F18-DISNEY-ALPHABET/F18-PRINCESS-ALPHABET.zip/BORDER-OUTLINE/SVG',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / TEXT FONT TEMPLATE / F18-DISNEY-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: true,
      swedish: false,
    },
    limitations: ['SS10 only in the current registry', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'huge-digits',
    displayName: 'Huge Digits',
    category: 'Library',
    style: 'Digits',
    suggestedText: '2026',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F7-Huge-Digits-ALPHABET/F7-HUGE-NUMBERS.zip/svg and cricut',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F7-Huge-Digits-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: false,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Digits only', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'line-font',
    displayName: 'Line Font',
    category: 'Library',
    style: 'Line',
    suggestedText: 'LINE',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F14-LINE-FONT-ALPHABET/F14-LINE-FONT-SS6-SS10.zip/SS10/SVG',
    libraryRelativeDirBySize: {
      SS6: 'FONT GENERATED CHATGPT/F14-LINE-FONT-ALPHABET/F14-LINE-FONT-SS6-SS10.zip/SS06/SVG',
      SS10: 'FONT GENERATED CHATGPT/F14-LINE-FONT-ALPHABET/F14-LINE-FONT-SS6-SS10.zip/SS10/SVG',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F14-LINE-FONT-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Uppercase and digits only', 'Resolved from zip-backed glyph files'],
  },
  {
    alphabetId: 'college-varsity',
    displayName: 'College Varsity',
    category: 'Library',
    style: 'Varsity',
    suggestedText: 'COLLEGE 24',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F6-COLLEGE-ALPHABET/F6-HUGE-COLLEGE-FONT/SVG-Cricut',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F6-COLLEGE-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Uppercase and digits only'],
  },
  {
    alphabetId: 'real-college',
    displayName: 'Real College',
    category: 'Library',
    style: 'Block',
    suggestedText: 'REAL 2026',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F4-REAL-ALPHABET/F4-COLLEGE-FONT-REAL/SVG',
    combinedSources: [
      {
        characters: 'ABCDEFGHIJKLM',
        libraryRelativeFile: 'FONT GENERATED CHATGPT/F4-REAL-ALPHABET/F4-COLLEGE-FONT-REAL/SVG/SVG_Alphabet02_ss10_uppercase_1.svg',
        targetStoneSizeId: 'SS10',
        groupMergeMargin: 120,
      },
      {
        characters: 'NOPQRSTUVWXYZ',
        libraryRelativeFile: 'FONT GENERATED CHATGPT/F4-REAL-ALPHABET/F4-COLLEGE-FONT-REAL/SVG/SVG_Alphabet02_ss10_uppercase_2.svg',
        targetStoneSizeId: 'SS10',
        groupMergeMargin: 120,
      },
      {
        characters: '0123456789',
        libraryRelativeFile: 'FONT GENERATED CHATGPT/F4-REAL-ALPHABET/F4-COLLEGE-FONT-REAL/SVG/SVG_Alphabet02_ss10_number.svg',
        targetStoneSizeId: 'SS10',
        groupMergeMargin: 120,
      },
    ],
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F4-REAL-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Resolved from combined SS10 strip files server-side'],
  },
  {
    alphabetId: 'forever-script',
    displayName: 'Forever',
    category: 'Library',
    style: 'Script',
    suggestedText: 'FOREVER',
    libraryRelativeDir: 'FONT GENERATED CHATGPT/F1-Forever-ALPHABET/F1-Rhinestone-Forever-SS06-SS10/Forever-SS10/SVG-Alphabet-Uppercase',
    libraryRelativeDirByCharacterClass: {
      uppercase: 'FONT GENERATED CHATGPT/F1-Forever-ALPHABET/F1-Rhinestone-Forever-SS06-SS10/Forever-SS10/SVG-Alphabet-Uppercase',
      lowercase: 'FONT GENERATED CHATGPT/F1-Forever-ALPHABET/F1-Rhinestone-Forever-SS06-SS10/Forever-SS10/SVG-Alphabet-lowercase',
      digits: 'FONT GENERATED CHATGPT/F1-Forever-ALPHABET/F1-Rhinestone-Forever-SS06-SS10/Forever-SS10/SVG-Digits-Numbers',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / FONT GENERATED CHATGPT / F1-Forever-ALPHABET',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: true,
      swedish: false,
    },
    limitations: ['SS10 only in the current registry; SS6 digit glyphs are not packaged as direct per-letter files'],
  },
  {
    alphabetId: 'scoreboard-block',
    displayName: 'Scoreboard',
    category: 'Library',
    style: 'Block',
    suggestedText: 'SCORE 2026',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F28-SCOREBOARD-ALPHABET/F28-SCOREBOARD-UNPACKED',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library (F28 Scoreboard package)',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Uppercase and digits only', 'Sized for SS10 package'],
  },
  {
    alphabetId: 'toys-bubble',
    displayName: 'Toys',
    category: 'Library',
    style: 'Bubble',
    suggestedText: 'TOYS',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F17-TOYS-ALPHABET/F17-TOYS-UNPACKED-SS10',
    libraryRelativeDirBySize: {
      SS6: 'TEXT FONT TEMPLATE/F17-TOYS-ALPHABET/F17-TOYS-UNPACKED-SS6',
      SS10: 'TEXT FONT TEMPLATE/F17-TOYS-ALPHABET/F17-TOYS-UNPACKED-SS10',
    },
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10', 'SS6'],
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library (F17 Toys package)',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: false,
      swedish: false,
    },
    limitations: ['Uppercase only', 'Sized for SS6/SS10 packages'],
  },
  {
    alphabetId: 'birthday-script',
    displayName: 'Birthday',
    category: 'Library',
    style: 'Script',
    suggestedText: 'HAPPY',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F19-BIRTHDAY-ALPHABET/F19-BIRTHDAY-UNPACKED',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library (F19 Birthday package)',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: false,
      swedish: false,
    },
    limitations: ['Uppercase only', 'Sized for SS10 package'],
  },
  {
    alphabetId: 'retro-wide',
    displayName: 'Retro Wide',
    category: 'Library',
    style: 'Retro',
    suggestedText: 'RETRO 76',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F24-RETRO-WIDE-A-ALPHABET/F24-RETRO-UNPACKED',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library (F24 Retro Wide A package)',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: true,
      swedish: false,
    },
    limitations: ['Uppercase and digits only', 'Sized for SS10 package'],
  },
  {
    alphabetId: 'varsity-collage-a',
    displayName: 'Varsity Collage A',
    category: 'Library',
    style: 'Varsity',
    suggestedText: 'CHEER',
    libraryRelativeDir: 'TEXT FONT TEMPLATE/F31-VARSITY-FONT-3COLOR-A/F31-VARSITY-A-UNPACKED',
    glyphExtension: '.svg',
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS10'],
    license: 'User-provided local asset',
    licenseSource: 'Attached LETTER UTVALDA library (F31 Varsity 3-Color A package)',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: false,
      digits: false,
      swedish: false,
    },
    limitations: ['Uppercase only', 'Sized for SS10 package', '3-color source flattened to single-color output'],
  },
  {
    alphabetId: 'old-english-gothic',
    displayName: 'Old English',
    category: 'Library',
    style: 'Gothic',
    suggestedText: 'OLD',
    libraryRelativeDir: 'Rhinestone fonts till projektet/F13-OLD-ENGLISH-RHINESTONE-FONT/SS10-UPPERCASE/SVG',
    libraryRelativeDirBySizeAndCharacterClass: {
      SS6: {
        uppercase: 'Rhinestone fonts till projektet/F13-OLD-ENGLISH-RHINESTONE-FONT/SS06-UPPERCASE/SVG',
        lowercase: 'Rhinestone fonts till projektet/F13-OLD-ENGLISH-RHINESTONE-FONT/SS06-LOWERCASE/SVG',
      },
      SS10: {
        uppercase: 'Rhinestone fonts till projektet/F13-OLD-ENGLISH-RHINESTONE-FONT/SS10-UPPERCASE/SVG',
        lowercase: 'Rhinestone fonts till projektet/F13-OLD-ENGLISH-RHINESTONE-FONT/SS10-LOWERCASE/SVG',
      },
    },
    glyphExtension: '.svg',
    // The SS10 lowercase source file for i is named with a dotless-ı; the
    // fallback lets 'i' resolve there (SS6 ships a correctly-named i.svg).
    glyphFileFallbackByChar: { i: 'ı' },
    // Baseline metrics for this design. Lowercase fractions are measured from
    // the package's own ALL-ALPHABET-old-english-Lowercase.svg strip, where
    // each row of letters shares a true baseline. Uppercase fractions come
    // from the Old London typeface this design is based on (per-glyph
    // bounding boxes relative to the font baseline). Only letters with a
    // meaningful below-baseline tail (or, for z, a raised bottom) are listed.
    baselineBelowFractionByChar: {
      A: 0.018, B: 0.139, C: 0.015, D: 0.064, E: 0.015, F: 0.171, G: 0.015,
      H: 0.164, I: 0.018, J: 0.166, K: 0.018, L: 0.035, M: 0.112, N: 0.095,
      O: 0.015, P: 0.172, Q: 0.06, R: 0.025, S: 0.028, T: 0.015, U: 0.016,
      V: 0.016, W: 0.016, X: 0.016, Y: 0.174, Z: 0.015, '&': 0.015,
      f: 0.07, g: 0.32, j: 0.167, p: 0.248, q: 0.22, s: 0.031, y: 0.234,
      z: -0.058,
    },
    authoredStoneSizeId: 'SS10',
    supportedTargetStoneSizeIds: ['SS6', 'SS10'],
    license: 'User-provided local asset',
    licenseSource: 'LETTER UTVALDA / Rhinestone fonts till projektet / F13-OLD-ENGLISH-RHINESTONE-FONT',
    isPrivate: true,
    characterCoverage: {
      uppercase: true,
      lowercase: true,
      digits: false,
      swedish: false,
    },
    limitations: [
      'No digit glyphs in this package',
      'A dense, fine-detail design (roughly 50-140 individual stones per letter) — at true stone size, letters render considerably larger than simpler block/script alphabets',
    ],
  },
];

const ALPHABET_MAP = new Map(SVG_ALPHABET_REGISTRY.map((entry) => [entry.alphabetId, entry]));

export function listSvgAlphabets(): readonly SvgAlphabetDefinition[] {
  return SVG_ALPHABET_REGISTRY;
}

export function getSvgAlphabetDefinition(alphabetId: SvgAlphabetId): SvgAlphabetDefinition {
  const entry = ALPHABET_MAP.get(alphabetId);
  if (!entry) {
    throw new Error(`Unknown SVG alphabet ID: ${alphabetId}`);
  }
  return entry;
}

export function isKnownSvgAlphabetId(alphabetId: string | undefined | null): alphabetId is SvgAlphabetId {
  return typeof alphabetId === 'string' && ALPHABET_MAP.has(alphabetId as SvgAlphabetId);
}
