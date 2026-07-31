/**
 * Rhinestone Font Loader
 *
 * Loads OpenType/TrueType fonts where glyphs contain pre-placed rhinestone shapes.
 * Uses opentype.js for parsing but extracts stone contours rather than rendering outlines.
 */

import * as opentype from 'opentype.js';
import {
  getRhinestoneFontDefinition,
  isKnownRhinestoneFontId,
  DEFAULT_RHINESTONE_FONT_ID,
  type RhinestoneFontDefinition,
  type RhinestoneFontId,
} from './rhinestoneFontRegistry';
import type { StoneSizeId } from '../types/index';

export interface LoadedRhinestoneFont {
  definition: RhinestoneFontDefinition;
  font: opentype.Font;
  loadedStoneSizeId?: StoneSizeId;
}

const parsedFontCache = new Map<string, Promise<LoadedRhinestoneFont>>();

function bufferToArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

async function readFontArrayBuffer(
  definition: RhinestoneFontDefinition,
  targetStoneSizeId?: StoneSizeId,
): Promise<ArrayBuffer> {
  if (!definition.assetUrl && !definition.nodeFilePath) {
    throw new Error(`Rhinestone font "${definition.displayName}" has no loadable asset.`);
  }

  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const { resolveRhinestoneFontFilePath } = await import('./fontLibraryPath');
    const resolvedPath = resolveRhinestoneFontFilePath(definition, targetStoneSizeId);

    if (!resolvedPath) {
      throw new Error(
        `Rhinestone font file not found for: ${definition.displayName}\n` +
        `Font: ${definition.displayName} (${definition.fontId})\n` +
        `Requested size: ${targetStoneSizeId ?? '(any)'}\n` +
        `Expected node path: ${definition.nodeFilePath ?? '(none)'}\n` +
        `Expected library-relative path: ${definition.libraryRelativePath ?? '(none)'}\n` +
        `This font must be available in RHINESTONE_FONT_LIBRARY_DIR, ~/Desktop/LETTER UTVALDA, or the repo font library.`
      );
    }

    const fileBuffer = await readFile(resolvedPath);
    return bufferToArrayBuffer(fileBuffer);
  }

  if (!definition.assetUrl) {
    throw new Error(`Rhinestone font "${definition.displayName}" has no browser asset URL.`);
  }

  const url = targetStoneSizeId ? `${definition.assetUrl}?size=${targetStoneSizeId}` : definition.assetUrl;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load rhinestone font asset for ${definition.displayName}: ${response.status}`);
  }
  return await response.arrayBuffer();
}

export async function loadRhinestoneFont(
  fontId: string | undefined | null,
  targetStoneSizeId?: StoneSizeId,
): Promise<LoadedRhinestoneFont> {
  const resolvedId = isKnownRhinestoneFontId(fontId) ? fontId : DEFAULT_RHINESTONE_FONT_ID;
  const definition = getRhinestoneFontDefinition(resolvedId);

  const hasSizedVariant = targetStoneSizeId !== undefined
    && definition.libraryRelativePathBySize?.[targetStoneSizeId] !== undefined;
  const cacheKey = hasSizedVariant
    ? `${definition.fontId}::${targetStoneSizeId}`
    : definition.fontId;

  const existing = parsedFontCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const arrayBuffer = await readFontArrayBuffer(definition, hasSizedVariant ? targetStoneSizeId : undefined);
    const font = opentype.parse(arrayBuffer);
    return { definition, font, loadedStoneSizeId: hasSizedVariant ? targetStoneSizeId : undefined };
  })();

  parsedFontCache.set(cacheKey, promise);
  return promise;
}

export function clearRhinestoneFontCacheForTests() {
  parsedFontCache.clear();
}

export function listCachedRhinestoneFontIds(): RhinestoneFontId[] {
  const ids = new Set<RhinestoneFontId>();
  for (const key of parsedFontCache.keys()) {
    const [fontId] = key.split('::');
    if (isKnownRhinestoneFontId(fontId)) ids.add(fontId);
  }
  return Array.from(ids);
}
