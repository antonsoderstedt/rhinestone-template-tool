import * as opentype from 'opentype.js';
import { getOutlineFontDefinition, isAvailableOutlineFontId, LEGACY_OUTLINE_FONT_ID, type OutlineFontDefinition } from './fontRegistry';

export interface LoadedOutlineFont {
  definition: OutlineFontDefinition;
  font: opentype.Font | null;
}

const parsedFontCache = new Map<string, Promise<LoadedOutlineFont>>();

const REQUIRED_FONT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÅÄÖåäö .,!?-_';

function bufferToArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const match = /^data:.*?(;base64)?,(.*)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid uploaded font data URL.');
  }

  const payload = match[2] ?? '';
  if (match[1]) {
    if (typeof Buffer !== 'undefined') {
      return bufferToArrayBuffer(Buffer.from(payload, 'base64'));
    }
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  return new TextEncoder().encode(decodeURIComponent(payload)).buffer;
}

async function readFontArrayBuffer(definition: OutlineFontDefinition): Promise<ArrayBuffer> {
  if (!definition.assetUrl && !definition.nodeFilePath) {
    throw new Error(`Font "${definition.displayName}" has no loadable asset.`);
  }

  if (definition.assetUrl?.startsWith('data:')) {
    return dataUrlToArrayBuffer(definition.assetUrl);
  }

  if (typeof window === 'undefined' && definition.nodeFilePath) {
    const { readFile } = await import('node:fs/promises');
    const fileBuffer = await readFile(definition.nodeFilePath);
    return bufferToArrayBuffer(fileBuffer);
  }

  if (!definition.assetUrl) {
    throw new Error(`Font "${definition.displayName}" has no browser asset URL.`);
  }

  const response = await fetch(definition.assetUrl);
  if (!response.ok) {
    throw new Error(`Failed to load font asset for ${definition.displayName}.`);
  }
  return await response.arrayBuffer();
}

function assertFontSupportsCharacters(font: opentype.Font, definition: OutlineFontDefinition) {
  const missingCharacters: string[] = [];
  for (const character of REQUIRED_FONT_CHARACTERS) {
    if (character === ' ') continue;
    if (font.charToGlyphIndex(character) === 0) {
      missingCharacters.push(character);
    }
  }
  if (missingCharacters.length > 0) {
    throw new Error(`Font ${definition.displayName} is missing required characters: ${missingCharacters.join(' ')}`);
  }
}

export async function loadOutlineFont(fontId: string | undefined | null): Promise<LoadedOutlineFont> {
  const resolvedId = isAvailableOutlineFontId(fontId) ? fontId! : LEGACY_OUTLINE_FONT_ID;
  const definition = getOutlineFontDefinition(resolvedId);

  if (definition.isLegacy) {
    return { definition, font: null };
  }

  const existing = parsedFontCache.get(definition.fontId);
  if (existing) return existing;

  const promise = (async () => {
    const arrayBuffer = await readFontArrayBuffer(definition);
    const font = opentype.parse(arrayBuffer);
    assertFontSupportsCharacters(font, definition);
    return { definition, font };
  })();

  parsedFontCache.set(definition.fontId, promise);
  return promise;
}

export function clearOutlineFontCacheForTests() {
  parsedFontCache.clear();
}

export function listCachedFontIds(): string[] {
  return Array.from(parsedFontCache.keys());
}
