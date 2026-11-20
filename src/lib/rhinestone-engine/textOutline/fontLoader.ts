import * as opentype from 'opentype.js';
import { getOutlineFontDefinition, isAvailableOutlineFontId, LEGACY_OUTLINE_FONT_ID, type OutlineFontDefinition } from './fontRegistry';

export interface LoadedOutlineFont {
  definition: OutlineFontDefinition;
  font: opentype.Font | null;
}

const parsedFontCache = new Map<string, Promise<LoadedOutlineFont>>();

/** Every usable font has these; a font without them is broken or not a text font. */
const BASIC_FONT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** Nice to have. Strict callers (HTV) still require them; the rhinestone studio only checks the typed text. */
const EXTENDED_FONT_CHARACTERS = 'ÅÄÖåäö .,!?-_';

export interface LoadOutlineFontOptions {
  /**
   * When true, a font that lacks Å Ä Ö å ä ö or common punctuation still loads, and the caller is
   * expected to check the characters it actually uses with `findUnsupportedCharacters`.
   * Default false: the font must cover the extended set too.
   */
  allowMissingExtendedCharacters?: boolean;
}

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

function listMissingCharacters(font: opentype.Font, characters: string): string[] {
  const missing: string[] = [];
  for (const character of characters) {
    if (/\s/.test(character)) continue;
    if (font.charToGlyphIndex(character) === 0 && !missing.includes(character)) {
      missing.push(character);
    }
  }
  return missing;
}

/** Characters of `text` the font has no glyph for (whitespace ignored), in order of first use. */
export function findUnsupportedCharacters(font: opentype.Font, text: string): string[] {
  return listMissingCharacters(font, text);
}

function assertFontSupportsCharacters(
  font: opentype.Font,
  definition: OutlineFontDefinition,
  options: LoadOutlineFontOptions,
) {
  const required = options.allowMissingExtendedCharacters
    ? BASIC_FONT_CHARACTERS
    : BASIC_FONT_CHARACTERS + EXTENDED_FONT_CHARACTERS;
  const missingCharacters = listMissingCharacters(font, required);
  if (missingCharacters.length > 0) {
    throw new Error(`Font ${definition.displayName} is missing required characters: ${missingCharacters.join(' ')}`);
  }
}

export async function loadOutlineFont(
  fontId: string | undefined | null,
  options: LoadOutlineFontOptions = {},
): Promise<LoadedOutlineFont> {
  const resolvedId = isAvailableOutlineFontId(fontId) ? fontId! : LEGACY_OUTLINE_FONT_ID;
  const definition = getOutlineFontDefinition(resolvedId);

  if (definition.isLegacy) {
    return { definition, font: null };
  }

  // The parsed font is cached; the coverage rule depends on the caller, so it is checked on every call.
  let existing = parsedFontCache.get(definition.fontId);
  if (!existing) {
    existing = (async () => {
      const arrayBuffer = await readFontArrayBuffer(definition);
      const font = opentype.parse(arrayBuffer);
      return { definition, font };
    })();
    parsedFontCache.set(definition.fontId, existing);
  }

  const loaded = await existing;
  if (loaded.font) assertFontSupportsCharacters(loaded.font, definition, options);
  return loaded;
}

export function clearOutlineFontCacheForTests() {
  parsedFontCache.clear();
}

export function listCachedFontIds(): string[] {
  return Array.from(parsedFontCache.keys());
}
