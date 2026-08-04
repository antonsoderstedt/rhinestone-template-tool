/**
 * Scan the local LETTER UTVALDA library and emit a machine-readable package
 * catalog with duplicate groups.
 *
 * Run with:
 *   npm run scan:letter-assets
 *   npm run scan:letter-assets -- --output output/letter-asset-scan.json
 *   npm run scan:letter-assets -- --root ~/Desktop/LETTER\ UTVALDA
 */

import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  groupDuplicateLetterAssets,
  summarizeLetterAssetPackage,
  type LetterAssetPackageSummary,
} from '../src/lib/rhinestone-engine/assetLibrary/letterAssetCatalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_LIBRARY_ROOT = join(homedir(), 'Desktop', 'LETTER UTVALDA');
const DEFAULT_OUTPUT_PATH = join(REPO_ROOT, 'output', 'letter-asset-scan.json');
const KNOWN_SOURCE_ROOTS = [
  'FONT GENERATED CHATGPT',
  'TEXT FONT TEMPLATE',
  'Rhinsestont font library',
] as const;
const CONTAINER_DIRECTORY_NAMES = new Set(['done']);

interface ScanOptions {
  libraryRoot: string;
  outputPath: string;
}

interface ScanReport {
  version: 1;
  generatedAt: string;
  libraryRoot: string;
  sourceRoots: Array<{
    name: string;
    absolutePath: string;
    exists: boolean;
    packageCount: number;
  }>;
  packageCount: number;
  duplicateGroupCount: number;
  packages: LetterAssetPackageSummary[];
  duplicateGroups: ReturnType<typeof groupDuplicateLetterAssets>;
}

function parseArgs(argv: readonly string[]): ScanOptions {
  let libraryRoot = process.env.RHINESTONE_FONT_LIBRARY_DIR || DEFAULT_LIBRARY_ROOT;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --root');
      }
      libraryRoot = value;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --output');
      }
      outputPath = value;
      index += 1;
      continue;
    }
  }

  return {
    libraryRoot: resolve(libraryRoot),
    outputPath: resolve(outputPath),
  };
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function isArchive(filename: string): boolean {
  return filename.toLowerCase().endsWith('.zip');
}

function listArchiveEntries(archivePath: string): string[] {
  try {
    const output = execFileSync('unzip', ['-Z1', archivePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.endsWith('/'))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function collectRelativeFilePaths(dir: string, prefix = ''): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name));

  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRelativeFilePaths(absolutePath, relativePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath);
      if (isArchive(entry.name)) {
        const archiveEntries = listArchiveEntries(absolutePath);
        for (const archiveEntry of archiveEntries) {
          files.push(`${relativePath}/${archiveEntry}`);
        }
      }
    }
  }
  return files;
}

function scanSourceRoot(sourceRootName: string, absolutePath: string): LetterAssetPackageSummary[] {
  const entries = readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name));

  const packages: LetterAssetPackageSummary[] = [];

  for (const entry of entries) {
    const entryPath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      if (CONTAINER_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
        const nestedEntries = readdirSync(entryPath, { withFileTypes: true })
          .filter((nestedEntry) => !nestedEntry.name.startsWith('.'))
          .sort((left, right) => left.name.localeCompare(right.name));

        for (const nestedEntry of nestedEntries) {
          const nestedPath = join(entryPath, nestedEntry.name);
          if (nestedEntry.isDirectory()) {
            packages.push(summarizeLetterAssetPackage({
              sourceRootName,
              packageName: nestedEntry.name,
              locationKind: 'directory',
              relativePaths: collectRelativeFilePaths(nestedPath),
            }));
            continue;
          }

          if (nestedEntry.isFile() && isArchive(nestedEntry.name)) {
            packages.push(summarizeLetterAssetPackage({
              sourceRootName,
              packageName: nestedEntry.name,
              locationKind: 'archive',
              relativePaths: [],
            }));
          }
        }
        continue;
      }

      const relativePaths = collectRelativeFilePaths(entryPath);
      packages.push(summarizeLetterAssetPackage({
        sourceRootName,
        packageName: entry.name,
        locationKind: 'directory',
        relativePaths,
      }));
      continue;
    }

    if (entry.isFile() && isArchive(entry.name)) {
      const archiveEntries = listArchiveEntries(entryPath);
      packages.push(summarizeLetterAssetPackage({
        sourceRootName,
        packageName: entry.name,
        locationKind: 'archive',
        relativePaths: archiveEntries,
      }));
    }
  }

  return packages;
}

function buildReport(options: ScanOptions): ScanReport {
  const packages: LetterAssetPackageSummary[] = [];
  const sourceRoots = KNOWN_SOURCE_ROOTS.map((sourceRootName) => {
    const absolutePath = join(options.libraryRoot, sourceRootName);
    let exists = false;
    let packageCount = 0;

    try {
      exists = statSync(absolutePath).isDirectory();
    } catch {
      exists = false;
    }

    if (exists) {
      const discovered = scanSourceRoot(sourceRootName, absolutePath);
      packages.push(...discovered);
      packageCount = discovered.length;
    }

    return {
      name: sourceRootName,
      absolutePath,
      exists,
      packageCount,
    };
  });

  const sortedPackages = [...packages].sort((left, right) => {
    const rootCompare = left.sourceRootName.localeCompare(right.sourceRootName);
    if (rootCompare !== 0) return rootCompare;
    return left.packageName.localeCompare(right.packageName);
  });
  const duplicateGroups = groupDuplicateLetterAssets(sortedPackages);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    libraryRoot: options.libraryRoot,
    sourceRoots,
    packageCount: sortedPackages.length,
    duplicateGroupCount: duplicateGroups.length,
    packages: sortedPackages,
    duplicateGroups,
  };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = buildReport(options);

  ensureDir(dirname(options.outputPath));
  writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Scanned library root: ${report.libraryRoot}`);
  console.log(`Packages: ${report.packageCount}`);
  console.log(`Duplicate groups: ${report.duplicateGroupCount}`);
  console.log(`Report written: ${options.outputPath}`);
}

main();