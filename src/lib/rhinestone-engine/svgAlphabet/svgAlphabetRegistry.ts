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

export type SvgAlphabetId = 'scoreboard-block';

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
