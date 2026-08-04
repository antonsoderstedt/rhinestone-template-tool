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
import type { StoneSizeId } from '../types/index';

const glyphCache = new Map<string, Promise<string | null>>();

async function loadGlyphSvgOnce(alphabetId: SvgAlphabetId, character: string, targetStoneSizeId?: StoneSizeId): Promise<string | null> {
  if (typeof window === 'undefined') {
    const { getSvgAlphabetDefinition } = await import('./svgAlphabetRegistry');
    const { loadSvgAlphabetGlyphText } = await import('./svgAlphabetPath');
    const definition = getSvgAlphabetDefinition(alphabetId);
    return await loadSvgAlphabetGlyphText(definition, character, targetStoneSizeId);
  }

  const query = targetStoneSizeId ? `?size=${encodeURIComponent(targetStoneSizeId)}` : '';
  const url = `/api/svg-alphabets/${encodeURIComponent(alphabetId)}/${encodeURIComponent(character)}${query}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return await response.text();
}

export const defaultSvgAlphabetGlyphLoader: SvgAlphabetGlyphLoader = {
  async loadGlyphSvg(alphabetId, character, targetStoneSizeId) {
    const cacheKey = `${alphabetId}::${targetStoneSizeId ?? 'default'}::${character}`;
    const existing = glyphCache.get(cacheKey);
    if (existing) return existing;
    const promise = loadGlyphSvgOnce(alphabetId, character, targetStoneSizeId);
    glyphCache.set(cacheKey, promise);
    return promise;
  },
};

export function clearSvgAlphabetGlyphCacheForTests() {
  glyphCache.clear();
}
