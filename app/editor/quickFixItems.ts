/**
 * Turns the export readiness result into a short list of problems the user can fix with one click.
 * Pure: it only reads the result; the editor performs the fix.
 */

import { HIGH_STONE_COUNT_THRESHOLD, getMatFit, MAT_LABELS, type ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';

export type QuickFixAction = 'auto-fix-spacing' | 'fit-12x12' | 'fit-12x24';

export interface QuickFixItem {
  id: 'spacing' | 'mat-too-large' | 'mat-needs-large' | 'many-stones';
  tone: 'warning' | 'info';
  title: string;
  detail: string;
  action: QuickFixAction | null;
  actionLabel: string | null;
}

const SPACING_CODES = new Set(['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP']);

export function hasSpacingIssues(result: ExportReadinessResult | null): boolean {
  return Boolean(result?.issues.some((issue) => SPACING_CODES.has(issue.code)));
}

export function getQuickFixes(result: ExportReadinessResult | null): QuickFixItem[] {
  if (!result || result.summary.stoneCount === 0) return [];
  const items: QuickFixItem[] = [];

  const spacingCount = result.issues.filter((issue) => SPACING_CODES.has(issue.code)).length;
  if (spacingCount > 0) {
    items.push({
      id: 'spacing',
      tone: 'warning',
      title: spacingCount === 1 ? '1 place where stones are too close' : `${spacingCount} places where stones are too close`,
      detail: 'Moves the stones that are too close apart, just enough to leave room to cut. Stones that cannot be moved far enough are removed. You can undo it.',
      action: 'auto-fix-spacing',
      actionLabel: 'Fix spacing automatically',
    });
  }

  const { widthMm, heightMm } = result.summary;
  const matFit = getMatFit(widthMm, heightMm);
  if (matFit.status === 'too-large') {
    items.push({
      id: 'mat-too-large',
      tone: 'warning',
      title: `Too big for a ${MAT_LABELS['12x24']} mat`,
      detail: `The design is ${widthMm.toFixed(0)} × ${heightMm.toFixed(0)} mm. The biggest Cricut mat cuts about 292 × 597 mm.`,
      action: 'fit-12x24',
      actionLabel: `Fit to ${MAT_LABELS['12x24']} mat`,
    });
  } else if (matFit.status === 'fits-12x24') {
    items.push({
      id: 'mat-needs-large',
      tone: 'info',
      title: `Needs a ${MAT_LABELS['12x24']} mat`,
      detail: `The design is ${widthMm.toFixed(0)} × ${heightMm.toFixed(0)} mm, which does not fit the standard ${MAT_LABELS['12x12']} mat.`,
      action: 'fit-12x12',
      actionLabel: `Shrink to fit a ${MAT_LABELS['12x12']} mat`,
    });
  }

  if (result.summary.stoneCount > HIGH_STONE_COUNT_THRESHOLD) {
    items.push({
      id: 'many-stones',
      tone: 'warning',
      title: `${result.summary.stoneCount.toLocaleString('en-US')} stones is a lot`,
      detail: 'It will take a long time to cut, weed and set. A larger stone size or a smaller design uses far fewer stones.',
      action: null,
      actionLabel: null,
    });
  }

  return items;
}
