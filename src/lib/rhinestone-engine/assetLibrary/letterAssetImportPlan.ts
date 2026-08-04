import type { LetterAssetCurationEntry } from './letterAssetCuration';

export type LetterAssetImportTarget = 'rhinestone-font' | 'svg-alphabet';
export type LetterAssetImportPriority = 'now' | 'next';
export type LetterAssetImportReadiness = 'ready' | 'blocked';
export type LetterAssetImportBlockedReason = 'no-direct-font-file' | 'combined-svg-strip' | 'no-direct-glyph-svg';

export interface LetterAssetImportSourceFacts {
  packageName: string;
  anyFontFileCount: number;
  directFontFileCount: number;
  directSvgFileCount: number;
  directGlyphSvgFileCount: number;
}

export interface LetterAssetImportPlanEntry {
  packageName: string;
  sourceRootName: string;
  target: LetterAssetImportTarget;
  proposedId: string;
  displayName: string;
  style: string;
  sampleText: string;
  priority: LetterAssetImportPriority;
  readiness: LetterAssetImportReadiness;
  blockedReason?: LetterAssetImportBlockedReason;
  reason: string;
}

export interface LetterAssetImportPlan {
  version: 1;
  summary: {
    rhinestoneFontCount: number;
    svgAlphabetCount: number;
  };
  entries: LetterAssetImportPlanEntry[];
}

interface LetterAssetImportRule {
  packageName: string;
  entries: readonly Omit<LetterAssetImportPlanEntry, 'packageName' | 'sourceRootName' | 'reason' | 'readiness' | 'blockedReason'>[];
}

const PRIORITY_SORT_ORDER: Record<LetterAssetImportPriority, number> = {
  now: 0,
  next: 1,
};

const READINESS_SORT_ORDER: Record<LetterAssetImportReadiness, number> = {
  ready: 0,
  blocked: 1,
};

const IMPORT_RULES: readonly LetterAssetImportRule[] = [
  {
    packageName: 'F4-REAL-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'atletico-real', displayName: 'Atletico Real', style: 'Block', sampleText: 'REAL2026', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'real-college', displayName: 'Real College', style: 'Block', sampleText: 'REAL 2026', priority: 'now' },
    ],
  },
  {
    packageName: 'F2-Cheer-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'cheer-block', displayName: 'Cheer Block', style: 'Block', sampleText: 'CHEER', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'cheer-block', displayName: 'Cheer Block', style: 'Block', sampleText: 'CHEER 24', priority: 'now' },
    ],
  },
  {
    packageName: 'F6-COLLEGE-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'college-varsity', displayName: 'College Varsity', style: 'Varsity', sampleText: 'COLLEGE', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'college-varsity', displayName: 'College Varsity', style: 'Varsity', sampleText: 'COLLEGE 24', priority: 'now' },
    ],
  },
  {
    packageName: 'F11-Big-Bold-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'big-bold', displayName: 'Big Bold', style: 'Block', sampleText: 'BOLD', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'big-bold', displayName: 'Big Bold', style: 'Block', sampleText: 'BOLD', priority: 'next' },
    ],
  },
  {
    packageName: 'F12-BRODWAY-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'broadway-retro', displayName: 'Broadway', style: 'Retro', sampleText: 'BROADWAY', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'broadway-retro', displayName: 'Broadway', style: 'Retro', sampleText: 'BROADWAY', priority: 'next' },
    ],
  },
  {
    packageName: 'F14-LINE-FONT-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'line-font-line', displayName: 'Line Font', style: 'Line', sampleText: 'LINE', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'line-font', displayName: 'Line Font', style: 'Line', sampleText: 'LINE', priority: 'next' },
    ],
  },
  {
    packageName: 'F17-TOYS-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'toys-bubble-font', displayName: 'Toys Bubble', style: 'Bubble', sampleText: 'TOYS', priority: 'now' },
    ],
  },
  {
    packageName: 'F18-DISNEY-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'disney-script', displayName: 'Disney Script', style: 'Script', sampleText: 'Disney', priority: 'now' },
      { target: 'svg-alphabet', proposedId: 'disney-script', displayName: 'Disney Script', style: 'Script', sampleText: 'MAGIC', priority: 'next' },
    ],
  },
  {
    packageName: 'F19-BIRTHDAY-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'birthday-script-font', displayName: 'Birthday Script', style: 'Script', sampleText: 'HAPPY', priority: 'now' },
    ],
  },
  {
    packageName: 'F24-RETRO-WIDE-A-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'retro-wide-font', displayName: 'Retro Wide', style: 'Retro', sampleText: 'RETRO', priority: 'now' },
    ],
  },
  {
    packageName: 'F28-SCOREBOARD-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'scoreboard-digits', displayName: 'Scoreboard', style: 'Digits', sampleText: '2026', priority: 'now' },
    ],
  },
  {
    packageName: 'F1-Forever-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'forever-script', displayName: 'Forever', style: 'Script', sampleText: 'Forever', priority: 'next' },
      { target: 'svg-alphabet', proposedId: 'forever-script', displayName: 'Forever', style: 'Script', sampleText: 'FOREVER', priority: 'next' },
    ],
  },
  {
    packageName: 'F3-Blessed-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'blessed-stone', displayName: 'Blessed', style: 'Script', sampleText: 'Blessed', priority: 'next' },
      { target: 'svg-alphabet', proposedId: 'blessed-script', displayName: 'Blessed', style: 'Script', sampleText: 'BLESSED', priority: 'next' },
    ],
  },
  {
    packageName: 'F5-Bride-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'bride-script', displayName: 'Bride', style: 'Script', sampleText: 'Bride', priority: 'next' },
      { target: 'svg-alphabet', proposedId: 'bride-script', displayName: 'Bride', style: 'Script', sampleText: 'BRIDE', priority: 'next' },
    ],
  },
  {
    packageName: 'F7-Huge-Digits-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'huge-digits', displayName: 'Huge Digits', style: 'Digits', sampleText: '2026', priority: 'next' },
      { target: 'svg-alphabet', proposedId: 'huge-digits', displayName: 'Huge Digits', style: 'Digits', sampleText: '2026', priority: 'next' },
    ],
  },
  {
    packageName: 'F26-SMALL-LINE-ALPHABET',
    entries: [
      { target: 'rhinestone-font', proposedId: 'small-line-font', displayName: 'Small Line', style: 'Line', sampleText: 'SMALL', priority: 'next' },
    ],
  },
  {
    packageName: 'F31-VARSITY-FONT-3COLOR-A',
    entries: [
      { target: 'rhinestone-font', proposedId: 'varsity-3color-a', displayName: 'Varsity 3-Color A', style: 'Varsity', sampleText: 'CHEER', priority: 'next' },
    ],
  },
  {
    packageName: 'xx-MONOGRAM-RHINESTONE',
    entries: [
      { target: 'rhinestone-font', proposedId: 'monogram-special', displayName: 'Monogram', style: 'Monogram', sampleText: 'ABC', priority: 'now' },
    ],
  },
];

function reasonFor(entry: Omit<LetterAssetImportPlanEntry, 'packageName' | 'sourceRootName' | 'reason' | 'readiness' | 'blockedReason'>): string {
  return entry.priority === 'now'
    ? 'High-priority first registry batch from ADR 0002 and current curation results.'
    : 'Good follow-up registry candidate once the first batch is landed.';
}

function buildSourceFactsMap(sourceFacts: readonly LetterAssetImportSourceFacts[]): Map<string, LetterAssetImportSourceFacts> {
  return new Map(sourceFacts.map((fact) => [fact.packageName, fact]));
}

function getReadiness(target: LetterAssetImportTarget, fact: LetterAssetImportSourceFacts | undefined): LetterAssetImportReadiness {
  if (!fact) return 'blocked';
  if (target === 'rhinestone-font') {
    return fact.directFontFileCount > 0 ? 'ready' : 'blocked';
  }
  return fact.directGlyphSvgFileCount > 0 ? 'ready' : 'blocked';
}

function getBlockedReason(target: LetterAssetImportTarget, fact: LetterAssetImportSourceFacts | undefined): LetterAssetImportBlockedReason | undefined {
  if (target === 'rhinestone-font') {
    return fact && fact.directFontFileCount > 0 ? undefined : 'no-direct-font-file';
  }
  if (fact && fact.directGlyphSvgFileCount > 0) {
    return undefined;
  }
  if (fact && fact.directSvgFileCount > 0) {
    return 'combined-svg-strip';
  }
  return 'no-direct-glyph-svg';
}

export function buildLetterAssetImportPlan(
  curationEntries: readonly LetterAssetCurationEntry[],
  existingRhinestoneFontIds: readonly string[],
  existingSvgAlphabetIds: readonly string[],
  sourceFacts: readonly LetterAssetImportSourceFacts[] = [],
): LetterAssetImportPlan {
  const candidateEntries = curationEntries.filter((entry) => entry.status === 'candidate');
  const candidateByPackageName = new Map(candidateEntries.map((entry) => [entry.packageName, entry]));
  const existingFontIds = new Set(existingRhinestoneFontIds);
  const existingAlphabetIds = new Set(existingSvgAlphabetIds);
  const sourceFactsByPackageName = buildSourceFactsMap(sourceFacts);

  const entries: LetterAssetImportPlanEntry[] = [];

  for (const rule of IMPORT_RULES) {
    const candidate = candidateByPackageName.get(rule.packageName);
    if (!candidate) continue;

    for (const plannedEntry of rule.entries) {
      const sourceFacts = sourceFactsByPackageName.get(candidate.packageName);

      if (plannedEntry.target === 'rhinestone-font' && (sourceFacts?.anyFontFileCount ?? 0) === 0) {
        continue;
      }
      if (plannedEntry.target === 'rhinestone-font' && existingFontIds.has(plannedEntry.proposedId)) {
        continue;
      }
      if (plannedEntry.target === 'svg-alphabet' && existingAlphabetIds.has(plannedEntry.proposedId)) {
        continue;
      }

      entries.push({
        packageName: candidate.packageName,
        sourceRootName: candidate.sourceRootName,
        target: plannedEntry.target,
        proposedId: plannedEntry.proposedId,
        displayName: plannedEntry.displayName,
        style: plannedEntry.style,
        sampleText: plannedEntry.sampleText,
        priority: plannedEntry.priority,
        readiness: getReadiness(plannedEntry.target, sourceFacts),
        blockedReason: getBlockedReason(plannedEntry.target, sourceFacts),
        reason: reasonFor(plannedEntry),
      });
    }
  }

  const sortedEntries = entries.sort((left, right) => {
    const priorityCompare = PRIORITY_SORT_ORDER[left.priority] - PRIORITY_SORT_ORDER[right.priority];
    if (priorityCompare !== 0) return priorityCompare;
    const readinessCompare = READINESS_SORT_ORDER[left.readiness] - READINESS_SORT_ORDER[right.readiness];
    if (readinessCompare !== 0) return readinessCompare;
    const targetCompare = left.target.localeCompare(right.target);
    if (targetCompare !== 0) return targetCompare;
    return left.packageName.localeCompare(right.packageName);
  });

  return {
    version: 1,
    summary: {
      rhinestoneFontCount: sortedEntries.filter((entry) => entry.target === 'rhinestone-font').length,
      svgAlphabetCount: sortedEntries.filter((entry) => entry.target === 'svg-alphabet').length,
    },
    entries: sortedEntries,
  };
}