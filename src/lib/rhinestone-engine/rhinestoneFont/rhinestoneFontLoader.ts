/**
 * Rhinestone Font Loader
 *
 * Loads OpenType/TrueType fonts where glyphs contain pre-placed rhinestone shapes.
 * Uses opentype.js for parsing but extracts stone contours rather than rendering outlines.
 */

import * as opentype from 'opentype.js';
import {
  getRhinestoneFontDefinition,
  getPreferredRhinestoneFontStoneSize,
  isKnownRhinestoneFontId,
  DEFAULT_RHINESTONE_FONT_ID,
  type RhinestoneFontDefinition,
  type RhinestoneFontId,
} from './rhinestoneFontRegistry';
import type { StoneSizeId } from '../types/index';

export interface LoadedRhinestoneFont {
  definition: RhinestoneFontDefinition;
  font: opentype.Font;
}

const parsedFontCache = new Map<string, Promise<LoadedRhinestoneFont>>();

function bufferToArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

async function readFontArrayBuffer(definition: RhinestoneFontDefinition, targetStoneSizeId?: StoneSizeId): Promise<ArrayBuffer> {
  if (!definition.assetUrl && !definition.nodeFilePath && !definition.libraryRelativePath && !definition.libraryRelativePathBySize) {
    throw new Error(`Rhinestone font "${definition.displayName}" has no loadable asset.`);
  }

  if (typeof window === 'undefined') {
    const { resolveRhinestoneFontFilePath } = await import('./fontLibraryPath');
    const resolvedPath = resolveRhinestoneFontFilePath(definition, targetStoneSizeId);
    if (!resolvedPath) {
      throw new Error(`Rhinestone font "${definition.displayName}" has no node file path.`);
    }
    const { readFile } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    
    if (!existsSync(resolvedPath)) {
      throw new Error(
        `Rhinestone font file not found: ${resolvedPath}\n` +
        `Font: ${definition.displayName} (${definition.fontId})\n` +
        `This font must be manually placed at the expected location.`
      );
    }
    
    const fileBuffer = await readFile(resolvedPath);
    return bufferToArrayBuffer(fileBuffer);
  }

  if (!definition.assetUrl) {
    throw new Error(`Rhinestone font "${definition.displayName}" has no browser asset URL.`);
  }

  const sizeId = targetStoneSizeId ?? getPreferredRhinestoneFontStoneSize(definition.fontId);
  const response = await fetch(`${definition.assetUrl}?size=${encodeURIComponent(sizeId)}`);
  if (!response.ok) {
    throw new Error(`Failed to load rhinestone font asset for ${definition.displayName}: ${response.status}`);
  }
  return await response.arrayBuffer();
}

export async function loadRhinestoneFont(fontId: string | undefined | null, targetStoneSizeId?: StoneSizeId): Promise<LoadedRhinestoneFont> {
  const resolvedId = isKnownRhinestoneFontId(fontId) ? fontId : DEFAULT_RHINESTONE_FONT_ID;
  const definition = getRhinestoneFontDefinition(resolvedId);
  const resolvedSizeId = targetStoneSizeId ?? getPreferredRhinestoneFontStoneSize(definition.fontId);
  const cacheKey = `${definition.fontId}::${resolvedSizeId}`;

  const existing = parsedFontCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const arrayBuffer = await readFontArrayBuffer(definition, resolvedSizeId);
    const font = opentype.parse(arrayBuffer);
    return { definition, font };
  })();

  parsedFontCache.set(cacheKey, promise);
  return promise;
}

export function clearRhinestoneFontCacheForTests() {
  parsedFontCache.clear();
}

export function listCachedRhinestoneFontIds(): RhinestoneFontId[] {
  return Array.from(parsedFontCache.keys()).filter((fontId): fontId is RhinestoneFontId =>
    isKnownRhinestoneFontId(fontId)
  );
}
