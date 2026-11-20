/**
 * Font audit: checks every bundled font and every imported (workspace-installed)
 * font file and lists the ones browsers or the outline engine cannot use.
 *
 *   npm run audit:fonts          report only
 *   npm run audit:fonts -- --fix drop corrupt imported fonts from the manifest
 *                                (files stay on disk) and record them under
 *                                `meta.excluded`; repairable ones are rewritten.
 *
 * Exit code 1 when a bundled font is unusable.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectFontBytes, repairFontBytes } from '../src/lib/rhinestone-engine/textOutline/fontInspection';
import { OUTLINE_FONT_REGISTRY } from '../src/lib/rhinestone-engine/textOutline/fontRegistry';

const INSTALLED_DIR = join(process.cwd(), 'public', 'fonts', 'workspace-installed');
const MANIFEST_PATH = join(INSTALLED_DIR, 'manifest.json');

interface ManifestFont {
  fontId: string;
  fileName: string;
  [key: string]: unknown;
}
interface Manifest {
  meta?: Record<string, unknown> & { excluded?: { fontId: string; fileName: string; reason: string }[] };
  fonts: ManifestFont[];
}

async function main() {
  const fix = process.argv.includes('--fix');
  let bundledProblems = 0;

  console.log('Bundled fonts');
  for (const font of OUTLINE_FONT_REGISTRY) {
    if (!font.nodeFilePath) continue;
    const bytes = new Uint8Array(await readFile(font.nodeFilePath));
    const inspection = inspectFontBytes(bytes);
    if (inspection.ok) continue;
    if (inspection.repairable) {
      console.log(`  repaired at serve time: ${font.fontId} — ${inspection.issues.map((issue) => issue.message).join('; ')}`);
    } else {
      bundledProblems += 1;
      console.log(`  UNUSABLE: ${font.fontId} — ${inspection.issues.map((issue) => issue.message).join('; ')}`);
    }
  }
  if (bundledProblems === 0) console.log('  all bundled fonts are usable');

  if (!existsSync(MANIFEST_PATH)) {
    console.log('\nNo imported fonts manifest found; skipping imported fonts.');
    process.exit(bundledProblems > 0 ? 1 : 0);
  }

  const raw = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as ManifestFont[] | Manifest;
  const manifest: Manifest = Array.isArray(raw) ? { fonts: raw } : raw;
  const kept: ManifestFont[] = [];
  const excluded: { fontId: string; fileName: string; reason: string }[] = [];
  let repaired = 0;

  for (const font of manifest.fonts) {
    const filePath = join(INSTALLED_DIR, font.fileName);
    if (!existsSync(filePath)) {
      excluded.push({ fontId: font.fontId, fileName: font.fileName, reason: 'File is missing.' });
      continue;
    }
    const bytes = new Uint8Array(await readFile(filePath));
    const inspection = inspectFontBytes(bytes);
    if (inspection.ok) {
      kept.push(font);
    } else if (inspection.repairable) {
      repaired += 1;
      if (fix) await writeFile(filePath, repairFontBytes(bytes));
      kept.push(font);
    } else {
      excluded.push({ fontId: font.fontId, fileName: font.fileName, reason: inspection.issues.map((issue) => issue.message).join('; ') });
    }
  }

  console.log(`\nImported fonts: ${manifest.fonts.length} checked, ${repaired} repairable, ${excluded.length} unusable`);
  for (const entry of excluded) console.log(`  UNUSABLE: ${entry.fileName} — ${entry.reason}`);

  if (fix) {
    const next: Manifest = {
      meta: { ...(manifest.meta ?? {}), excluded, excludedCount: excluded.length },
      fonts: kept,
    };
    await writeFile(MANIFEST_PATH, JSON.stringify(next, null, 2));
    console.log(`\nManifest rewritten: ${kept.length} fonts kept, ${excluded.length} excluded.`);
  } else if (excluded.length > 0 || repaired > 0) {
    console.log('\nRun with --fix to exclude unusable fonts from the manifest and repair the rest.');
  }

  process.exit(bundledProblems > 0 ? 1 : 0);
}

void main();
