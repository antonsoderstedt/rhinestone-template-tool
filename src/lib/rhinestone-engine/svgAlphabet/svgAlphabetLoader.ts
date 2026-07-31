/**
 * SVG Alphabet Glyph Loader
 *
 * Concrete glyph loader that reads per-letter SVGs from the LETTER UTVALDA
 * library on the server and via the /api/svg-alphabets/[alphabetId]/[character]
 * route in the browser. Mirrors the split-load pattern used by the rhinestone
 * font loader.
 */

import type { SvgAlphabetGlyphLoader } from './svgAlphabetTemplate';
import type { SvgAlphabetId } from './svgAlphabetRegistry';

const glyphCache = new Map<string, Promise<string | null>>();

async function loadGlyphSvgOnce(alphabetId: SvgAlphabetId, character: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    const { getSvgAlphabetDefinition } = await import('./svgAlphabetRegistry');
    const { resolveSvgAlphabetGlyphPath } = await import('./svgAlphabetPath');
    const { readFile } = await import('node:fs/promises');
    const definition = getSvgAlphabetDefinition(alphabetId);
    const path = resolveSvgAlphabetGlyphPath(definition, character);
    if (!path) return null;
    return await readFile(path, 'utf-8');
  }

  const url = `/api/svg-alphabets/${encodeURIComponent(alphabetId)}/${encodeURIComponent(character)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return await response.text();
}

export const defaultSvgAlphabetGlyphLoader: SvgAlphabetGlyphLoader = {
  async loadGlyphSvg(alphabetId, character) {
    const cacheKey = `${alphabetId}::${character}`;
    const existing = glyphCache.get(cacheKey);
    if (existing) return existing;
    const promise = loadGlyphSvgOnce(alphabetId, character);
    glyphCache.set(cacheKey, promise);
    return promise;
  },
};

export function clearSvgAlphabetGlyphCacheForTests() {
  glyphCache.clear();
}
