/**
 * Turns the imported font files into a light, browsable library.
 *
 *   npm run build:fonts                      (reads public/fonts/workspace-installed, writes public/font-library)
 *   npm run build:fonts -- <source> <out>
 *
 * Output (git-ignored: the fonts are the user's own licensed files):
 *   catalog.json     one small entry per font, for browsing (family, category, size), plus `aliases` from every earlier
 *                    font id to the one that was kept, so saved designs still find their font
 *   f/<fontId>.woff  the font reduced to the characters the tool uses (Latin letters, digits, punctuation, Nordic and western
 *                    European accents) and stored as WOFF (opentype.js reads WOFF but not WOFF2)
 *
 * Fonts that are the same font in several file formats (otf, ttf, woff) are kept once: the smallest result wins. A font whose
 * reduced copy has no outline for A, a or 0 is left out.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import subsetFont from 'subset-font';
import * as opentypeModule from 'opentype.js';

// Under plain Node the package's functions are on `default`; bundlers expose them on the namespace.
const opentype: typeof opentypeModule = (opentypeModule as unknown as { default?: typeof opentypeModule }).default ?? opentypeModule;

interface ManifestFont {
  fontId: string;
  name: string;
  familyName?: string;
  variantName?: string;
  fileName: string;
  category?: string;
  sizeBytes?: number;
}

export interface FontLibraryEntry {
  id: string;
  /** Display name, e.g. "Acelon-Italic". */
  name: string;
  family: string;
  variant: string;
  category: string;
  /** Bytes of the reduced font. */
  bytes: number;
}

export interface FontLibraryCatalog {
  version: 1;
  builtAt: string;
  fonts: FontLibraryEntry[];
  /** How many fonts were left out (no usable outline for A, a or 0). */
  excluded: number;
  /** Earlier font id -> the id that was kept. */
  aliases: Record<string, string>;
}

// Basic Latin, Latin-1 Supplement, Latin Extended-A (Nordic, Polish, Czech, Turkish ...) and common punctuation.
const CHARACTERS = (() => {
  let text = '';
  for (let code = 0x20; code <= 0x7e; code++) text += String.fromCharCode(code);
  for (let code = 0xa0; code <= 0x17f; code++) text += String.fromCharCode(code);
  return text + '‘’“”‚„–—…•€™♥★';
})();

const MUST_HAVE = ['A', 'a', '0'];

function hasOutline(font: opentype.Font, character: string): boolean {
  const glyph = font.charToGlyph(character);
  return glyph.index !== 0 && glyph.getPath(0, 0, 100).commands.length > 2;
}

async function reduce(source: Buffer): Promise<Buffer | null> {
  try {
    const out = await subsetFont(source, CHARACTERS, { targetFormat: 'woff' });
    const copy = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    const font = opentype.parse(copy);
    return MUST_HAVE.every((character) => hasOutline(font, character)) ? Buffer.from(out) : null;
  } catch {
    return null;
  }
}

async function main() {
  const source = resolve(process.argv[2] ?? 'public/fonts/workspace-installed');
  const out = resolve(process.argv[3] ?? 'public/font-library');
  const manifestPath = join(source, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest.json in ${source}`);
    process.exit(1);
  }
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestFont[] | { fonts?: ManifestFont[] };
  const fonts = Array.isArray(parsed) ? parsed : (parsed.fonts ?? []);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'f'), { recursive: true });

  // The same font in several file formats shares a display name: keep one.
  const groups = new Map<string, ManifestFont[]>();
  for (const font of fonts) {
    const key = font.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), font]);
  }

  const entries: FontLibraryEntry[] = [];
  const aliases: Record<string, string> = {};
  let rejected = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  let done = 0;
  const queue = [...groups.values()];

  const worker = async () => {
    for (let group = queue.shift(); group; group = queue.shift()) {
      let best: { font: ManifestFont; data: Buffer } | null = null;
      for (const font of group) {
        const file = join(source, font.fileName);
        if (!existsSync(file)) continue;
        bytesBefore += statSync(file).size;
        const data = await reduce(readFileSync(file));
        if (data && (!best || data.length < best.data.length)) best = { font, data };
      }
      if (!best) {
        rejected++;
      } else {
        const { font, data } = best;
        writeFileSync(join(out, 'f', `${font.fontId}.woff`), data);
        bytesAfter += data.length;
        entries.push({
          id: font.fontId,
          name: font.name,
          family: (font.familyName ?? font.name.split(/[-_ ]/)[0] ?? font.name).trim(),
          variant: (font.variantName ?? '').trim(),
          category: font.category ?? 'Display',
          bytes: data.length,
        });
        for (const other of group) if (other.fontId !== font.fontId) aliases[other.fontId] = font.fontId;
      }
      if (++done % 100 === 0) process.stdout.write(`\r${done}/${groups.size}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  entries.sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const catalog: FontLibraryCatalog = { version: 1, builtAt: new Date().toISOString(), fonts: entries, excluded: rejected, aliases };
  writeFileSync(join(out, 'catalog.json'), JSON.stringify(catalog));

  const families = new Set(entries.map((e) => e.family.toLowerCase()));
  const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
  console.log(`\n${entries.length} fonts in ${families.size} families (${fonts.length} files read, ${rejected} left out, ${Object.keys(aliases).length} duplicates merged)`);
  console.log(`Size: ${mb(bytesBefore)} -> ${mb(bytesAfter)} (${out})`);
}

void main();
