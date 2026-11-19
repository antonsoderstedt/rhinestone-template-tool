/**
 * Pure checks for font files, shared by the import script, the font audit and
 * the font-serving route. A font that passes `opentype.parse` can still be
 * rejected by browsers (WOFF header size mismatch) or be useless for stones
 * (glyph table present but empty), so both are checked explicitly.
 */

import * as opentype from 'opentype.js';

export type FontIssueCode =
  /** WOFF header says the file is shorter than it is: browsers refuse it; trimming fixes it. */
  | 'woff-length-trailing-bytes'
  /** WOFF header says the file is longer than it is: data is missing; not repairable. */
  | 'woff-truncated'
  | 'unparseable'
  /** Parses, but none of the sample glyphs has an outline (e.g. zero-length glyf table). */
  | 'no-outlines';

export interface FontIssue {
  code: FontIssueCode;
  message: string;
}

export interface FontInspection {
  /** True when the font is usable as-is. */
  ok: boolean;
  /** True when `repairFontBytes` yields a usable font. */
  repairable: boolean;
  issues: FontIssue[];
}

const SAMPLE_CHARACTERS = ['A', 'a', 'O', 'o', '1', 'S'];

function isWoff(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x46;
}

function woffDeclaredLength(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Drops bytes after the end the WOFF header declares. Other files are returned unchanged. */
export function repairFontBytes(bytes: Uint8Array): Uint8Array {
  if (isWoff(bytes)) {
    const declared = woffDeclaredLength(bytes);
    if (declared > 0 && declared < bytes.length) return bytes.subarray(0, declared);
  }
  return bytes;
}

function checkOutlines(bytes: Uint8Array): FontIssue | null {
  let font: opentype.Font;
  try {
    font = opentype.parse(toArrayBuffer(bytes));
  } catch (error) {
    return { code: 'unparseable', message: `Could not be parsed: ${error instanceof Error ? error.message : String(error)}` };
  }

  const hasOutline = SAMPLE_CHARACTERS.some((character) => {
    try {
      return font.charToGlyph(character).getPath(0, 0, 100).commands.length > 0;
    } catch {
      return false;
    }
  });
  return hasOutline ? null : { code: 'no-outlines', message: 'No letter or digit has an outline (empty glyph data).' };
}

export function inspectFontBytes(bytes: Uint8Array): FontInspection {
  const issues: FontIssue[] = [];

  if (isWoff(bytes)) {
    const declared = woffDeclaredLength(bytes);
    if (declared > bytes.length) {
      issues.push({ code: 'woff-truncated', message: `WOFF header declares ${declared} bytes but the file has ${bytes.length}.` });
      return { ok: false, repairable: false, issues };
    }
    if (declared > 0 && declared < bytes.length) {
      issues.push({
        code: 'woff-length-trailing-bytes',
        message: `WOFF header declares ${declared} bytes but the file has ${bytes.length}; browsers reject it.`,
      });
    }
  }

  const repaired = repairFontBytes(bytes);
  const outlineIssue = checkOutlines(repaired);
  if (outlineIssue) {
    issues.push(outlineIssue);
    return { ok: false, repairable: false, issues };
  }

  return { ok: issues.length === 0, repairable: issues.length > 0, issues };
}
