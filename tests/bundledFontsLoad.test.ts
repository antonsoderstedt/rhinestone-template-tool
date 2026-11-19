import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as opentype from 'opentype.js';
import { OUTLINE_FONT_REGISTRY } from '../src/lib/rhinestone-engine/textOutline/fontRegistry';
import { inspectFontBytes, repairFontBytes } from '../src/lib/rhinestone-engine/textOutline/fontInspection';

describe('every registered bundled font loads', () => {
  const fonts = OUTLINE_FONT_REGISTRY.filter((font) => font.nodeFilePath);

  it.each(fonts.map((font) => [font.fontId, font.nodeFilePath!] as const))('%s parses and has outlines', async (_id, path) => {
    const buffer = await readFile(path);
    const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const outline = font.charToGlyph('A').getPath(0, 0, 100);
    expect(outline.commands.length).toBeGreaterThan(0);
  });
});

describe('font inspection', () => {
  const read = async (path: string) => new Uint8Array(await readFile(path));

  it('every registered bundled font is usable as served (after repair)', async () => {
    for (const font of OUTLINE_FONT_REGISTRY.filter((entry) => entry.nodeFilePath)) {
      const inspection = inspectFontBytes(repairFontBytes(await read(font.nodeFilePath!)));
      expect(inspection.ok, `${font.fontId}: ${inspection.issues.map((issue) => issue.message).join('; ')}`).toBe(true);
    }
  });

  it('detects the fredoka-one WOFF header mismatch and repairs it', async () => {
    const bytes = await read('node_modules/@fontsource/fredoka-one/files/fredoka-one-latin-400-normal.woff');
    const inspection = inspectFontBytes(bytes);
    expect(inspection.ok).toBe(false);
    expect(inspection.repairable).toBe(true);
    expect(inspection.issues[0]?.code).toBe('woff-length-trailing-bytes');

    const repaired = repairFontBytes(bytes);
    expect(repaired.length).toBeLessThan(bytes.length);
    expect(new DataView(repaired.buffer, repaired.byteOffset).getUint32(8)).toBe(repaired.length);
    expect(inspectFontBytes(repaired)).toEqual({ ok: true, repairable: false, issues: [] });
  });

  it('flags a truncated WOFF as not repairable', async () => {
    const bytes = await read('node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff');
    const inspection = inspectFontBytes(bytes.subarray(0, Math.floor(bytes.length / 2)));
    expect(inspection).toMatchObject({ ok: false, repairable: false });
    expect(inspection.issues[0]?.code).toBe('woff-truncated');
  });

  it('flags files that are not fonts', () => {
    const inspection = inspectFontBytes(new TextEncoder().encode('this is not a font file at all'));
    expect(inspection).toMatchObject({ ok: false, repairable: false });
    expect(inspection.issues[0]?.code).toBe('unparseable');
  });

  it('leaves a healthy font untouched', async () => {
    const bytes = await read('node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff');
    expect(repairFontBytes(bytes)).toBe(bytes);
  });
});
