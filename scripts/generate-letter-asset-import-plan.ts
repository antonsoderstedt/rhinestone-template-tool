import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLetterAssetImportPlan } from '../src/lib/rhinestone-engine/assetLibrary/letterAssetImportPlan.js';
import type { LetterAssetCurationEntry } from '../src/lib/rhinestone-engine/assetLibrary/letterAssetCuration.js';
import type { LetterAssetPackageSummary } from '../src/lib/rhinestone-engine/assetLibrary/letterAssetCatalog.js';
import { RHINESTONE_FONT_REGISTRY } from '../src/lib/rhinestone-engine/rhinestoneFont/rhinestoneFontRegistry.js';
import { SVG_ALPHABET_REGISTRY } from '../src/lib/rhinestone-engine/svgAlphabet/svgAlphabetRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DEFAULT_CURATION_PATH = join(REPO_ROOT, 'output', 'letter-asset-curation.json');
const DEFAULT_SCAN_PATH = join(REPO_ROOT, 'output', 'letter-asset-scan.json');
const DEFAULT_JSON_OUTPUT_PATH = join(REPO_ROOT, 'output', 'letter-asset-import-plan.json');
const DEFAULT_MARKDOWN_OUTPUT_PATH = join(REPO_ROOT, 'output', 'letter-asset-import-plan.md');

interface Options {
  curationPath: string;
  scanPath: string;
  jsonOutputPath: string;
  markdownOutputPath: string;
}

function parseArgs(argv: readonly string[]): Options {
  let curationPath = DEFAULT_CURATION_PATH;
  let scanPath = DEFAULT_SCAN_PATH;
  let jsonOutputPath = DEFAULT_JSON_OUTPUT_PATH;
  let markdownOutputPath = DEFAULT_MARKDOWN_OUTPUT_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--curation') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --curation');
      curationPath = value;
      index += 1;
      continue;
    }
    if (arg === '--scan') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --scan');
      scanPath = value;
      index += 1;
      continue;
    }
    if (arg === '--json-output') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --json-output');
      jsonOutputPath = value;
      index += 1;
      continue;
    }
    if (arg === '--markdown-output') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --markdown-output');
      markdownOutputPath = value;
      index += 1;
    }
  }

  return {
    curationPath: resolve(curationPath),
    scanPath: resolve(scanPath),
    jsonOutputPath: resolve(jsonOutputPath),
    markdownOutputPath: resolve(markdownOutputPath),
  };
}

function buildSourceFacts(packages: readonly LetterAssetPackageSummary[]) {
  return packages.map((pkg) => ({
    packageName: pkg.packageName,
    anyFontFileCount: pkg.relativePaths.filter((path) => /\.(otf|ttf)$/i.test(path)).length,
    directFontFileCount: pkg.relativePaths.filter((path) => (path.endsWith('.otf') || path.endsWith('.ttf')) && !path.includes('.zip/')).length,
    directSvgFileCount: pkg.relativePaths.filter((path) => path.endsWith('.svg') && !path.includes('.zip/')).length,
    directGlyphSvgFileCount: pkg.relativePaths.filter((path) => /(^|\/)[:A-Za-z0-9&.-]\.svg$/u.test(path)).length,
  }));
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function toMarkdown(plan: ReturnType<typeof buildLetterAssetImportPlan>): string {
  const lines = [
    '# Letter Asset Import Plan',
    '',
    `- Rhinestone fonts: ${plan.summary.rhinestoneFontCount}`,
    `- SVG alphabets: ${plan.summary.svgAlphabetCount}`,
    '',
    '| Readiness | Blocked Reason | Priority | Target | Proposed ID | Display Name | Source Package | Style | Sample |',
    '|---|---|---|---|---|---|---|---|---|',
  ];

  for (const entry of plan.entries) {
    lines.push(`| ${entry.readiness} | ${entry.blockedReason ?? ''} | ${entry.priority} | ${entry.target} | ${entry.proposedId} | ${entry.displayName} | ${entry.packageName} | ${entry.style} | ${entry.sampleText} |`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const parsed = JSON.parse(readFileSync(options.curationPath, 'utf8')) as { entries: LetterAssetCurationEntry[] };
  const scan = JSON.parse(readFileSync(options.scanPath, 'utf8')) as { packages: LetterAssetPackageSummary[] };
  const plan = buildLetterAssetImportPlan(
    parsed.entries,
    RHINESTONE_FONT_REGISTRY.map((entry) => entry.fontId),
    SVG_ALPHABET_REGISTRY.map((entry) => entry.alphabetId),
    buildSourceFacts(scan.packages),
  );

  ensureDir(dirname(options.jsonOutputPath));
  ensureDir(dirname(options.markdownOutputPath));
  writeFileSync(options.jsonOutputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  writeFileSync(options.markdownOutputPath, toMarkdown(plan), 'utf8');

  console.log(`Curation source: ${options.curationPath}`);
  console.log(`Planned rhinestone fonts: ${plan.summary.rhinestoneFontCount}`);
  console.log(`Planned svg alphabets: ${plan.summary.svgAlphabetCount}`);
  console.log(`JSON written: ${options.jsonOutputPath}`);
  console.log(`Markdown written: ${options.markdownOutputPath}`);
}

main();