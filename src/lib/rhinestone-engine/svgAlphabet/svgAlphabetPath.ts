/**
 * SVG Alphabet Glyph Path Resolver
 *
 * Server-side resolver that finds a specific glyph SVG file inside a user's
 * LETTER UTVALDA library directory. Same fallback chain as fontLibraryPath so
 * the two systems can share library roots.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SvgAlphabetDefinition } from './svgAlphabetRegistry';
import type { StoneSizeId } from '../types/index';

function getLibraryRoots(): string[] {
  const roots = [
    process.env.RHINESTONE_FONT_LIBRARY_DIR,
    join(homedir(), 'Desktop', 'LETTER UTVALDA'),
    join(process.cwd(), 'public', 'fonts', 'rhinestone-library'),
  ];
  return roots.filter((root): root is string => typeof root === 'string' && root.length > 0);
}

/**
 * Resolve the absolute filesystem path of a single glyph SVG in an alphabet.
 * The character is used as the file basename (e.g. 'A' → 'A.svg'). When the
 * alphabet ships size-specific glyph folders, the requested targetStoneSizeId
 * picks the matching subfolder; otherwise the default libraryRelativeDir is
 * used.
 */
export function resolveSvgAlphabetGlyphPath(
  definition: SvgAlphabetDefinition,
  character: string,
  targetStoneSizeId?: StoneSizeId,
): string | null {
  if (!character || character.length !== 1) return null;
  const filename = `${character}${definition.glyphExtension}`;

  const sizedDir = targetStoneSizeId ? definition.libraryRelativeDirBySize?.[targetStoneSizeId] : undefined;
  const dir = sizedDir ?? definition.libraryRelativeDir;

  for (const root of getLibraryRoots()) {
    const candidate = join(root, dir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
