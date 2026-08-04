import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curateLetterAssets } from '../src/lib/rhinestone-engine/assetLibrary/letterAssetCuration.js';
import type { LetterAssetPackageSummary } from '../src/lib/rhinestone-engine/assetLibrary/letterAssetCatalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_SCAN_PATH = join(REPO_ROOT, 'output', 'letter-asset-scan.json');
const DEFAULT_OUTPUT_PATH = join(REPO_ROOT, 'output', 'letter-asset-curation.json');

interface CurationScriptOptions {
  scanPath: string;
  outputPath: string;
}

function parseArgs(argv: readonly string[]): CurationScriptOptions {
  let scanPath = DEFAULT_SCAN_PATH;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scan') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --scan');
      scanPath = value;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --output');
      outputPath = value;
      index += 1;
    }
  }

  return {
    scanPath: resolve(scanPath),
    outputPath: resolve(outputPath),
  };
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const parsed = JSON.parse(readFileSync(options.scanPath, 'utf8')) as { packages: LetterAssetPackageSummary[] };
  const manifest = curateLetterAssets(parsed.packages);

  ensureDir(dirname(options.outputPath));
  writeFileSync(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Scan source: ${options.scanPath}`);
  console.log(`Candidates: ${manifest.summary.candidateCount}`);
  console.log(`Duplicate archives: ${manifest.summary.duplicateArchiveCount}`);
  console.log(`Needs review: ${manifest.summary.reviewCount}`);
  console.log(`Manifest written: ${options.outputPath}`);
}

main();