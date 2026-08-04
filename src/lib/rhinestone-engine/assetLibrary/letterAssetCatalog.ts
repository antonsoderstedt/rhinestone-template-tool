import type { StoneSizeId } from '../types/index';

export type LetterAssetLocationKind = 'directory' | 'archive';
export type LetterAssetKind = 'rhinestone-font' | 'svg-alphabet' | 'archive-only' | 'unknown';

export interface LetterAssetInspectionInput {
  sourceRootName: string;
  packageName: string;
  locationKind: LetterAssetLocationKind;
  relativePaths: readonly string[];
}

export interface LetterAssetPackageSummary {
  sourceRootName: string;
  packageName: string;
  locationKind: LetterAssetLocationKind;
  canonicalName: string;
  duplicateKey: string;
  suggestedId: string;
  assetKinds: readonly LetterAssetKind[];
  supportedStoneSizes: readonly StoneSizeId[];
  containsOpenType: boolean;
  containsSvg: boolean;
  relativePaths: readonly string[];
  notes: readonly string[];
}

export interface LetterAssetDuplicateGroup {
  duplicateKey: string;
  packageNames: readonly string[];
  packages: readonly LetterAssetPackageSummary[];
}

const STONE_SIZES: readonly StoneSizeId[] = ['SS6', 'SS10'];

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeForName(value: string): string {
  return value
    .replace(/\.[^.]+$/u, '')
    .replace(/\s*\(\d+\)$/u, '')
    .replace(/[_.-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function toKebabCase(value: string): string {
  return normalizeForName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/gu, '-');
}

function detectStoneSizes(values: readonly string[]): StoneSizeId[] {
  const text = values.join('\n');
  return STONE_SIZES.filter((sizeId) => new RegExp(sizeId.replace('SS', 'SS\\s*'), 'i').test(text));
}

function detectKinds(locationKind: LetterAssetLocationKind, relativePaths: readonly string[]): LetterAssetKind[] {
  const lowered = relativePaths.map((path) => path.toLowerCase());
  const containsOpenType = lowered.some((path) => path.endsWith('.otf') || path.endsWith('.ttf'));
  const containsSvg = lowered.some((path) => path.endsWith('.svg'));
  const kinds: LetterAssetKind[] = [];

  if (containsOpenType) {
    kinds.push('rhinestone-font');
  }
  if (containsSvg) {
    kinds.push('svg-alphabet');
  }
  if (kinds.length === 0 && locationKind === 'archive') {
    kinds.push('archive-only');
  }
  if (kinds.length === 0) {
    kinds.push('unknown');
  }

  return kinds;
}

export function normalizeLetterAssetPackageName(packageName: string): string {
  return normalizeForName(packageName).toLowerCase();
}

export function summarizeLetterAssetPackage(input: LetterAssetInspectionInput): LetterAssetPackageSummary {
  const canonicalName = normalizeForName(input.packageName);
  const relativePaths = uniqueSorted(input.relativePaths);
  const supportedStoneSizes = detectStoneSizes([input.packageName, ...relativePaths]);
  const assetKinds = detectKinds(input.locationKind, relativePaths);
  const containsOpenType = assetKinds.includes('rhinestone-font');
  const containsSvg = assetKinds.includes('svg-alphabet');
  const notes: string[] = [];

  if (input.locationKind === 'archive' && relativePaths.length === 0) {
    notes.push('Archive not inspected; classification is based on the archive name only.');
  }
  if (supportedStoneSizes.length === 0) {
    notes.push('Stone size could not be inferred from names.');
  }
  if (assetKinds.includes('unknown')) {
    notes.push('Package needs manual review.');
  }

  return {
    sourceRootName: input.sourceRootName,
    packageName: input.packageName,
    locationKind: input.locationKind,
    canonicalName,
    duplicateKey: normalizeLetterAssetPackageName(input.packageName),
    suggestedId: toKebabCase(input.packageName),
    assetKinds,
    supportedStoneSizes,
    containsOpenType,
    containsSvg,
    relativePaths,
    notes,
  };
}

export function groupDuplicateLetterAssets(packages: readonly LetterAssetPackageSummary[]): LetterAssetDuplicateGroup[] {
  const grouped = new Map<string, LetterAssetPackageSummary[]>();

  for (const pkg of packages) {
    const existing = grouped.get(pkg.duplicateKey);
    if (existing) {
      existing.push(pkg);
    } else {
      grouped.set(pkg.duplicateKey, [pkg]);
    }
  }

  return Array.from(grouped.entries())
    .filter(([, group]) => group.length > 1)
    .map(([duplicateKey, group]) => ({
      duplicateKey,
      packageNames: uniqueSorted(group.map((pkg) => pkg.packageName)),
      packages: [...group].sort((left, right) => left.packageName.localeCompare(right.packageName)),
    }))
    .sort((left, right) => left.duplicateKey.localeCompare(right.duplicateKey));
}