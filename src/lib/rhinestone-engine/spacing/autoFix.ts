/**
 * One-click "fix my design" for spacing problems.
 *
 * Runs `resolveStoneSpacing` (the same nudge algorithm used when a design is generated) on a
 * template the user has already edited, and reports what changed so the UI can say so honestly.
 * Collision detection is never skipped: the result is validated again and anything still wrong is
 * returned in `remainingIssues`. Pure and deterministic.
 */

import type { RhinestoneTemplate } from '../types/index';
import { validateRhinestoneTemplate, type TemplateValidationIssue } from '../validation/templateValidation';
import { resolveStoneSpacing } from './resolveStoneSpacing';

const SPACING_CODES = new Set(['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP']);

export interface AutoFixSpacingOptions {
  /** Minimum edge-to-edge gap, in millimetres. */
  minGapMm: number;
}

export interface AutoFixSpacingResult {
  template: RhinestoneTemplate;
  /** Spacing problems found before fixing, counted as affected stone pairs. */
  issuesBefore: number;
  movedStoneCount: number;
  removedStoneCount: number;
  maxDisplacementMm: number;
  /** True when something actually changed. */
  changed: boolean;
  /** Problems still present afterwards (empty when the template is clean). */
  remainingIssues: TemplateValidationIssue[];
}

function countSpacingIssues(template: RhinestoneTemplate, minGapMm: number): number {
  return validateRhinestoneTemplate(template, { minGapMm }).issues.filter((issue) => SPACING_CODES.has(issue.code)).length;
}

export function autoFixSpacing(template: RhinestoneTemplate, options: AutoFixSpacingOptions): AutoFixSpacingResult {
  const { minGapMm } = options;
  const issuesBefore = countSpacingIssues(template, minGapMm);

  if (issuesBefore === 0) {
    return {
      template,
      issuesBefore: 0,
      movedStoneCount: 0,
      removedStoneCount: 0,
      maxDisplacementMm: 0,
      changed: false,
      remainingIssues: validateRhinestoneTemplate(template, { minGapMm }).issues,
    };
  }

  // resolveStoneSpacing keeps counts from earlier runs in metadata when nothing needs fixing; clear
  // them first so the report only describes this fix.
  const { movedStoneCount: _moved, removedStoneCount: _removed, maxDisplacementMm: _max, ...restMetadata } = template.metadata ?? {};
  void _moved; void _removed; void _max;
  const resolved = resolveStoneSpacing({ ...template, metadata: restMetadata }, { minGapMm, strategy: 'nudge' });

  const num = (value: unknown) => (typeof value === 'number' ? value : 0);
  const movedStoneCount = num(resolved.metadata?.movedStoneCount);
  const removedStoneCount = num(resolved.metadata?.removedStoneCount);

  return {
    template: resolved,
    issuesBefore,
    movedStoneCount,
    removedStoneCount,
    maxDisplacementMm: num(resolved.metadata?.maxDisplacementMm),
    changed: movedStoneCount > 0 || removedStoneCount > 0,
    remainingIssues: validateRhinestoneTemplate(resolved, { minGapMm }).issues,
  };
}
