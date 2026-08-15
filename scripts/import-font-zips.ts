import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import * as opentype from 'opentype.js';

const DEFAULT_INPUT_DIR = '/Users/sulaysoderstedt/Desktop/FONTS';
const OUTPUT_DIR = join(process.cwd(), 'public', 'fonts', 'workspace-installed');
const MANIFEST_PATH = join(OUTPUT_DIR, 'manifest.json');
const SUPPORTED_EXTENSIONS = new Set(['.otf', '.ttf', '.woff']);
const ZIP_IO_MAX_BUFFER = 128 * 1024 * 1024;

type CoverageMode = 'outline' | 'fill' | 'outline-fill' | 'contour';

interface InstalledWorkspaceFontManifestEntry {
  fontId: string;
  name: string;
  familyName: string;
  variantName: string;
  importSourceLabel: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  styleLabel: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  previewFamily: string;
  previewText: string;
  licenseSource: string;
  note: string;
  preferredTextCoverageMode: 'outline' | 'fill' | 'outline-fill';
  supportedTextCoverageModes: CoverageMode[];
  sourceKind: 'workspace-installed';
  assetUrl: string;
  nodeFilePath: string;
}

interface InstalledWorkspaceFontManifest {
  meta: {
    generatedAt: string;
    importedCount: number;
    skippedCount: number;
    zipArchiveCount: number;
    sourceDirectory: string;
  };
  fonts: InstalledWorkspaceFontManifestEntry[];
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function firstNameValue(record: Record<string, string> | undefined): string | null {
  if (!record) return null;
  return record.en ?? record['en-US'] ?? Object.values(record)[0] ?? null;
}

function inferCategory(text: string): string {
  const normalized = text.toLowerCase();
  if (/script|signature|handwritten|calligraphy|brush|monoline/.test(normalized)) return 'Script';
  if (/serif|fashion|luxury|elegant|classic/.test(normalized)) return 'Serif';
  if (/condensed|narrow/.test(normalized)) return 'Condensed';
  if (/bubble|kids|fun|playful|candy|cartoon/.test(normalized)) return 'Bubble';
  if (/gothic|blackletter|tattoo/.test(normalized)) return 'Gothic';
  if (/varsity|sport|athletic/.test(normalized)) return 'Varsity';
  if (/mono|monospace/.test(normalized)) return 'Display';
  return 'Display';
}

function inferCoverageDefault(text: string): 'outline' | 'fill' | 'outline-fill' {
  const normalized = text.toLowerCase();
  if (/serif|bubble|bold|chunky/.test(normalized)) return 'outline-fill';
  return 'outline';
}

function listZipEntries(zipPath: string): string[] {
  const output = execFileSync('unzip', ['-Z1', zipPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: ZIP_IO_MAX_BUFFER,
  });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function readZipEntryBuffer(zipPath: string, entryPath: string): Buffer {
  return execFileSync('unzip', ['-p', zipPath, entryPath], {
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: ZIP_IO_MAX_BUFFER,
  }) as Buffer;
}

function contentTypeForExtension(extension: string): string {
  if (extension === '.ttf') return 'font/ttf';
  if (extension === '.woff') return 'font/woff';
  return 'font/otf';
}

async function main() {
  const inputDir = process.argv[2] ?? DEFAULT_INPUT_DIR;
  if (!existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const entries = await readdir(inputDir, { withFileTypes: true });
  const zipFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip')).map((entry) => entry.name).sort();
  if (zipFiles.length === 0) {
    throw new Error(`No zip files found in ${inputDir}`);
  }

  const manifest: InstalledWorkspaceFontManifestEntry[] = [];
  const seenFontIds = new Set<string>();
  let importedCount = 0;
  let skippedCount = 0;

  for (const zipName of zipFiles) {
    const zipPath = join(inputDir, zipName);
    const archiveEntries = listZipEntries(zipPath);
    for (const archiveEntry of archiveEntries) {
      const extension = extname(archiveEntry).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) continue;

      const fileBuffer = readZipEntryBuffer(zipPath, archiveEntry);
      let parsedFont: opentype.Font;
      try {
        parsedFont = opentype.parse(bufferToArrayBuffer(fileBuffer));
      } catch {
        skippedCount += 1;
        continue;
      }

      const fullName = firstNameValue(parsedFont.names.fullName as Record<string, string> | undefined)
        ?? firstNameValue(parsedFont.names.fontFamily as Record<string, string> | undefined)
        ?? basename(archiveEntry, extension);
      const familyName = firstNameValue(parsedFont.names.fontFamily as Record<string, string> | undefined) ?? fullName;
      const subfamily = firstNameValue(parsedFont.names.fontSubfamily as Record<string, string> | undefined) ?? 'Imported';
      const postscript = firstNameValue(parsedFont.names.postScriptName as Record<string, string> | undefined) ?? fullName;

      let fontId = `installed-${slugify(`${fullName}-${subfamily}`)}`;
      let suffix = 2;
      while (seenFontIds.has(fontId)) {
        fontId = `installed-${slugify(`${fullName}-${subfamily}`)}-${suffix}`;
        suffix += 1;
      }
      seenFontIds.add(fontId);

      const outputFileName = `${fontId}${extension}`;
      const outputPath = join(OUTPUT_DIR, outputFileName);
      await writeFile(outputPath, fileBuffer);

      const preferredTextCoverageMode = inferCoverageDefault(`${fullName} ${subfamily}`);
      const now = new Date().toISOString();
      manifest.push({
        fontId,
        name: fullName,
        familyName,
        variantName: subfamily,
        importSourceLabel: zipName,
        fileName: outputFileName,
        mimeType: contentTypeForExtension(extension),
        sizeBytes: fileBuffer.byteLength,
        category: inferCategory(`${fullName} ${zipName}`),
        styleLabel: subfamily,
        tags: ['zip-import', extension.slice(1)],
        favorite: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
        previewFamily: `WorkspaceInstalled_${slugify(postscript).replace(/-/g, '_')}`,
        previewText: 'Sulay 123',
        licenseSource: `Imported from ${zipName}`,
        note: `Imported from ${zipName}. Review outline quality before production cutting.`,
        preferredTextCoverageMode,
        supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
        sourceKind: 'workspace-installed',
        assetUrl: `/fonts/workspace-installed/${outputFileName}`,
        nodeFilePath: `public/fonts/workspace-installed/${outputFileName}`,
      });
      importedCount += 1;
    }
  }

  const manifestDocument: InstalledWorkspaceFontManifest = {
    meta: {
      generatedAt: new Date().toISOString(),
      importedCount,
      skippedCount,
      zipArchiveCount: zipFiles.length,
      sourceDirectory: inputDir,
    },
    fonts: manifest,
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifestDocument, null, 2));

  console.log(`Imported ${importedCount} font files from ${zipFiles.length} zip archives.`);
  if (skippedCount > 0) {
    console.log(`Skipped ${skippedCount} entries that could not be parsed by opentype.js.`);
  }
  console.log(`Manifest written to ${MANIFEST_PATH}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});