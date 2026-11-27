/**
 * Gets a file ready to be uploaded to the libraries (ADR 0063): an SVG becomes a design (the same compact stones the built library
 * has, made by the same engine code), a font file is checked and encoded. All of it happens in the browser, so the Worker only ever
 * stores text. Pure: nothing is read from the page.
 */

import { compactFromStones, importRhinestoneTemplate, inspectFontBytes, repairFontBytes } from '@/src/lib/rhinestone-engine/index';
import { FONT_FORMATS, ITEM_LIMITS, MAX_FONT_BYTES, type DesignMeta, type FontFormat } from '@/src/lib/library/libraryItems';

/** A file name as a readable name: no extension, underscores and dashes as spaces. */
export function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base.slice(0, 120) || 'Untitled';
}

function mostCommon(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 10) / 10;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export type DesignReason = 'unreadable' | 'no-stones' | 'too-large';
export type DesignPrepared = { ok: true; name: string; design: DesignMeta; data: string } | { ok: false; reason: DesignReason };

/** An SVG rhinestone template as a design. A file that is not one (artwork with no stones, an unsafe or broken SVG) is refused. */
export function prepareDesign(svgText: string, fileName: string): DesignPrepared {
  let result;
  try {
    result = importRhinestoneTemplate({ svgText, applyPageScale: true });
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (result.stones.length === 0) return { ok: false, reason: 'no-stones' };
  // Stones but no usable size: the file is not a template the studios can place. A huge one is too large, not "without stones".
  if (!(result.widthMm > 0) || !(result.heightMm > 0)) return { ok: false, reason: 'unreadable' };
  if (result.widthMm > 3000 || result.heightMm > 3000) return { ok: false, reason: 'too-large' };
  const data = JSON.stringify(compactFromStones(result.stones));
  if (data.length > ITEM_LIMITS.designChars) return { ok: false, reason: 'too-large' };
  return {
    ok: true,
    name: nameFromFileName(fileName),
    data,
    design: {
      stones: result.stones.length,
      widthMm: Math.round(result.widthMm * 10) / 10,
      heightMm: Math.round(result.heightMm * 10) / 10,
      stoneMm: mostCommon(result.stones.map((s) => s.diameterMm)),
    },
  };
}

/** The format of a font file from its first bytes (not from its name): null for anything the studios cannot read, WOFF2 included. */
export function fontFormatOf(bytes: Uint8Array): FontFormat | null {
  if (bytes.length < 4) return null;
  const tag = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true' || tag === '\u0000\u0001\u0000\u0000') return 'ttf';
  return null;
}

export type FontReason = 'format' | 'too-large' | 'unusable';
export type FontPrepared = { ok: true; name: string; format: FontFormat; data: string } | { ok: false; reason: FontReason; detail?: string };

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** A font file checked (and repaired when the engine knows how) and encoded as base64 text. */
export function prepareFont(fileName: string, original: Uint8Array): FontPrepared {
  const format = fontFormatOf(original);
  if (!format || !(FONT_FORMATS as readonly string[]).includes(format)) return { ok: false, reason: 'format' };
  const inspection = inspectFontBytes(original);
  if (!inspection.ok && !inspection.repairable) return { ok: false, reason: 'unusable', detail: inspection.issues.map((issue) => issue.message).join(' ') };
  const bytes = repairFontBytes(original);
  if (bytes.length > MAX_FONT_BYTES) return { ok: false, reason: 'too-large' };
  return { ok: true, name: nameFromFileName(fileName), format, data: bytesToBase64(bytes) };
}
