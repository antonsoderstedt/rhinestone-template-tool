/**
 * Builds a browsable design collection from a folder of ready-made rhinestone templates (zip files and loose SVGs).
 *
 *   npm run import:designs -- "/path/to/BUNDLE-RHINESTONE 2"
 *
 * It writes `public/design-library/` (not committed: the designs are the user's own files and large):
 *   index.json          one entry per design: title, category, stone count, size in mm, stone size, file
 *   svg/<id>.svg        the template itself
 *
 * Only the SVG of each design is read. Zip files are treated as untrusted: entries are listed first, only plain `.svg` names
 * are extracted (to memory, never to disk paths from the archive), and every file goes through the engine's own SVG safety
 * check and template import, so a file that is not a rhinestone template (artwork, no stones) is left out.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { importRhinestoneTemplate } from '../src/lib/rhinestone-engine/index';

const MAX_SVG_BYTES = 25 * 1024 * 1024;

export interface DesignCollectionEntry {
  id: string;
  title: string;
  category: string;
  /** Where it came from inside the source folder, for the user's own reference. */
  source: string;
  stones: number;
  widthMm: number;
  heightMm: number;
  /** The most common stone (hole) diameter in the design, mm. */
  stoneMm: number;
  file: string;
}

function slug(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'design';
}

function pretty(text: string): string {
  return text
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(svg|dxf|eps|pdf|cdr)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === '__MACOSX') continue;
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function safeEntryName(name: string): boolean {
  if (!name.toLowerCase().endsWith('.svg')) return false;
  if (name.startsWith('/') || name.includes('..') || name.includes('\\') || name.startsWith('__MACOSX') || name.includes('/__MACOSX/')) return false;
  return !basename(name).startsWith('.');
}

function listZipSvgs(zipPath: string): string[] {
  try {
    const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return listing.split('\n').map((l) => l.trimEnd()).filter(safeEntryName);
  } catch {
    return [];
  }
}

function readZipEntry(zipPath: string, entry: string): string | null {
  try {
    const buffer = execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: MAX_SVG_BYTES, stdio: ['ignore', 'pipe', 'ignore'] });
    return buffer.length > 0 && buffer.length <= MAX_SVG_BYTES ? buffer.toString('utf8') : null;
  } catch {
    return null;
  }
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 10) / 10;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of counts) if (count > bestCount) { best = key; bestCount = count; }
  return best;
}

function main() {
  const sourceArg = process.argv[2];
  if (!sourceArg) {
    console.error('Usage: npm run import:designs -- "<folder with zip files and SVGs>" [output folder]');
    process.exit(1);
  }
  const source = resolve(sourceArg);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    console.error(`Not a folder: ${source}`);
    process.exit(1);
  }
  const out = resolve(process.argv[3] ?? 'public/design-library');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'svg'), { recursive: true });

  const files = walk(source);
  const seen = new Set<string>();
  const entries: DesignCollectionEntry[] = [];
  let skippedNoStones = 0;
  let skippedUnreadable = 0;
  let duplicates = 0;

  const consider = (svgText: string, relPath: string, zipName: string | null, entryName: string) => {
    const hash = createHash('sha1').update(svgText).digest('hex');
    if (seen.has(hash)) {
      duplicates++;
      return;
    }
    seen.add(hash);
    let result;
    try {
      result = importRhinestoneTemplate({ svgText, applyPageScale: true });
    } catch {
      skippedUnreadable++;
      return;
    }
    if (result.stones.length === 0 || result.widthMm <= 0 || result.widthMm > 3000 || result.heightMm > 3000) {
      skippedNoStones++;
      return;
    }
    const parts = relPath.split(sep);
    const category = pretty(parts.length > 1 ? parts[0]! : (zipName ?? 'Designs')) || 'Designs';
    const titleBase = pretty(basename(entryName)) ;
    const title = !titleBase || /^\d+$/.test(titleBase) || titleBase.length < 3 ? `${pretty(zipName ?? category)} ${titleBase}`.trim() : titleBase;
    const id = `${slug(category)}-${slug(zipName ?? '')}-${slug(basename(entryName, '.svg'))}-${hash.slice(0, 6)}`;
    writeFileSync(join(out, 'svg', `${id}.svg`), svgText);
    entries.push({
      id,
      title,
      category,
      source: zipName ? `${relPath} › ${entryName}` : relPath,
      stones: result.stones.length,
      widthMm: Math.round(result.widthMm * 10) / 10,
      heightMm: Math.round(result.heightMm * 10) / 10,
      stoneMm: mostCommon(result.stones.map((s) => s.diameterMm)),
      file: `svg/${id}.svg`,
    });
  };

  let done = 0;
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const rel = relative(source, file);
    if (ext === '.svg') {
      if (statSync(file).size <= MAX_SVG_BYTES) consider(readFileSync(file, 'utf8'), rel, null, basename(file));
    } else if (ext === '.zip') {
      const zipName = basename(file, '.zip');
      for (const entry of listZipSvgs(file)) {
        const text = readZipEntry(file, entry);
        if (text) consider(text, rel, zipName, entry);
      }
    }
    if (++done % 25 === 0) process.stdout.write(`\r${done}/${files.length} files, ${entries.length} designs`);
  }

  entries.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title, undefined, { numeric: true }));
  writeFileSync(join(out, 'index.json'), JSON.stringify({ version: 1, builtAt: new Date().toISOString(), designs: entries }));
  const categories = new Set(entries.map((e) => e.category));
  console.log(`\nDone: ${entries.length} designs in ${categories.size} categories -> ${out}`);
  console.log(`Left out: ${skippedNoStones} without identifiable stones, ${skippedUnreadable} unreadable or unsafe, ${duplicates} duplicates.`);
}

main();
