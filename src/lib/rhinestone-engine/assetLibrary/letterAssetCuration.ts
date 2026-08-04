import type { LetterAssetKind, LetterAssetPackageSummary } from './letterAssetCatalog';

export type LetterAssetCurationStatus = 'candidate' | 'duplicate-archive' | 'review';

export interface LetterAssetCurationEntry {
  packageName: string;
  sourceRootName: string;
  suggestedId: string;
  status: LetterAssetCurationStatus;
  canonicalPackageName: string;
  recommendedKinds: readonly Exclude<LetterAssetKind, 'archive-only' | 'unknown'>[];
  reason: string;
  notes: readonly string[];
}

export interface LetterAssetCurationManifest {
  version: 1;
  packageCount: number;
  summary: {
    candidateCount: number;
    duplicateArchiveCount: number;
    reviewCount: number;
  };
  entries: LetterAssetCurationEntry[];
}

function getRecommendedKinds(pkg: LetterAssetPackageSummary): Array<Exclude<LetterAssetKind, 'archive-only' | 'unknown'>> {
  return pkg.assetKinds.filter(
    (kind): kind is Exclude<LetterAssetKind, 'archive-only' | 'unknown'> => kind !== 'archive-only' && kind !== 'unknown',
  );
}

function buildPreferredPackageMap(packages: readonly LetterAssetPackageSummary[]): Map<string, LetterAssetPackageSummary> {
  const preferred = new Map<string, LetterAssetPackageSummary>();

  for (const pkg of packages) {
    const current = preferred.get(pkg.duplicateKey);
    if (!current) {
      preferred.set(pkg.duplicateKey, pkg);
      continue;
    }

    const currentScore = Number(current.locationKind === 'directory') * 4 + Number(current.containsOpenType || current.containsSvg) * 2 + Number(current.notes.length === 0);
    const nextScore = Number(pkg.locationKind === 'directory') * 4 + Number(pkg.containsOpenType || pkg.containsSvg) * 2 + Number(pkg.notes.length === 0);

    if (nextScore > currentScore || (nextScore === currentScore && pkg.packageName.localeCompare(current.packageName) < 0)) {
      preferred.set(pkg.duplicateKey, pkg);
    }
  }

  return preferred;
}

export function curateLetterAssets(packages: readonly LetterAssetPackageSummary[]): LetterAssetCurationManifest {
  const preferredByDuplicateKey = buildPreferredPackageMap(packages);
  const entries = [...packages]
    .sort((left, right) => {
      const rootCompare = left.sourceRootName.localeCompare(right.sourceRootName);
      if (rootCompare !== 0) return rootCompare;
      return left.packageName.localeCompare(right.packageName);
    })
    .map<LetterAssetCurationEntry>((pkg) => {
      const preferred = preferredByDuplicateKey.get(pkg.duplicateKey) ?? pkg;
      const recommendedKinds = getRecommendedKinds(pkg);

      if (pkg.locationKind === 'archive' && preferred.packageName !== pkg.packageName) {
        return {
          packageName: pkg.packageName,
          sourceRootName: pkg.sourceRootName,
          suggestedId: pkg.suggestedId,
          status: 'duplicate-archive',
          canonicalPackageName: preferred.packageName,
          recommendedKinds,
          reason: 'Archive duplicate of a stronger package source.',
          notes: pkg.notes,
        };
      }

      if (pkg.containsOpenType || pkg.containsSvg) {
        return {
          packageName: pkg.packageName,
          sourceRootName: pkg.sourceRootName,
          suggestedId: pkg.suggestedId,
          status: 'candidate',
          canonicalPackageName: preferred.packageName,
          recommendedKinds,
          reason: 'Contains source assets that are usable for registry curation.',
          notes: pkg.notes,
        };
      }

      return {
        packageName: pkg.packageName,
        sourceRootName: pkg.sourceRootName,
        suggestedId: pkg.suggestedId,
        status: 'review',
        canonicalPackageName: preferred.packageName,
        recommendedKinds,
        reason: 'Needs manual review before it can be curated into the app.',
        notes: pkg.notes,
      };
    });

  return {
    version: 1,
    packageCount: entries.length,
    summary: {
      candidateCount: entries.filter((entry) => entry.status === 'candidate').length,
      duplicateArchiveCount: entries.filter((entry) => entry.status === 'duplicate-archive').length,
      reviewCount: entries.filter((entry) => entry.status === 'review').length,
    },
    entries,
  };
}