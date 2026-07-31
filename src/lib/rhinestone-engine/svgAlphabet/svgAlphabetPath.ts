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
 * The character is used as the file basename (e.g. 'A' → 'A.svg').
 */
export function resolveSvgAlphabetGlyphPath(
  definition: SvgAlphabetDefinition,
  character: string,
): string | null {
  if (!character || character.length !== 1) return null;
  const filename = `${character}${definition.glyphExtension}`;

  for (const root of getLibraryRoots()) {
    const candidate = join(root, definition.libraryRelativeDir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
