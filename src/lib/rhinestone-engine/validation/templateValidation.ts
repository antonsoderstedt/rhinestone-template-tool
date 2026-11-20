import type { RhinestoneTemplate } from '../types/index';
import { distanceBetweenPoints } from '../geometry/distance';

function getTemplateSource(template: RhinestoneTemplate): 'user' | 'vendor' | 'unknown' {
  const source = template.source ?? (typeof template.metadata?.source === 'string' ? template.metadata.source : undefined);
  if (source === 'vendor') return 'vendor';
  if (source === 'user') return 'user';
  return 'unknown';
}

function getStoneEdgeGapMm(a: RhinestoneTemplate['stones'][number], b: RhinestoneTemplate['stones'][number]): number {
  const centerDistanceMm = distanceBetweenPoints(a.center, b.center);
  const radiusSumMm = a.holeDiameterMm / 2 + b.holeDiameterMm / 2;
  return centerDistanceMm - radiusSumMm;
}

export type TemplateValidationSeverity = 'error' | 'warning';

export interface TemplateValidationIssue {
  severity: TemplateValidationSeverity;
  code: string;
  message: string;
  stoneIds?: string[];
  measuredGapMm?: number;
  requiredGapMm?: number;
}

export interface TemplateValidationResult {
  valid: boolean;
  issues: TemplateValidationIssue[];
}

export interface TemplateValidationOptions {
  minGapMm?: number;
  requireUniqueStoneIds?: boolean;
  requireNoCollisions?: boolean;
}

interface ResolvedValidationOptions {
  minGapMm: number;
  requireUniqueStoneIds: boolean;
  requireNoCollisions: boolean;
}

function resolveOptions(opts: TemplateValidationOptions = {}): ResolvedValidationOptions {
  return {
    minGapMm: opts.minGapMm ?? 0,
    requireUniqueStoneIds: opts.requireUniqueStoneIds ?? true,
    requireNoCollisions: opts.requireNoCollisions ?? true,
  };
}

export function validateRhinestoneTemplate(
  template: RhinestoneTemplate,
  options: TemplateValidationOptions = {},
): TemplateValidationResult {
  const opts = resolveOptions(options);
  const issues: TemplateValidationIssue[] = [];

  if (template.unit !== 'mm') {
    issues.push({
      severity: 'error',
      code: 'INVALID_UNIT',
      message: `template.unit must be "mm", got "${template.unit}". All internal measurements must be in millimeters.`,
    });
  }

  if (typeof template.id !== 'string' || template.id.trim().length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_ID',
      message: 'template.id must be a non-empty string.',
    });
  }

  if (typeof template.name !== 'string' || template.name.trim().length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_NAME',
      message: 'template.name must be a non-empty string.',
    });
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < template.stones.length; i++) {
    const stone = template.stones[i]!;

    if (typeof stone.holeDiameterMm !== 'number' || stone.holeDiameterMm <= 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_HOLE_DIAMETER',
        message: `Stone "${stone.id}" at index ${i} has invalid holeDiameterMm (${stone.holeDiameterMm}). Must be a positive number.`,
        stoneIds: [stone.id],
      });
    }

    if (opts.requireUniqueStoneIds) {
      if (seenIds.has(stone.id)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_STONE_ID',
          message: `Duplicate stone id "${stone.id}" at index ${i}.`,
          stoneIds: [stone.id],
        });
      }
      seenIds.add(stone.id);
    }
  }

  if (opts.requireNoCollisions && template.stones.length > 1) {
    const source = getTemplateSource(template);

    for (let i = 0; i < template.stones.length; i++) {
      for (let j = i + 1; j < template.stones.length; j++) {
        const a = template.stones[i]!;
        const b = template.stones[j]!;
        const measuredGapMm = getStoneEdgeGapMm(a, b);
        const requiredGapMm = opts.minGapMm;

        if (measuredGapMm < 0) {
          issues.push({
            severity: 'error',
            code: 'STONE_OVERLAP',
            message: `Stones "${a.id}" and "${b.id}" are ${measuredGapMm.toFixed(3)} mm apart (minimum 0.00 mm). Overlapping holes will tear the material.`,
            stoneIds: [a.id, b.id],
            measuredGapMm,
            requiredGapMm: 0,
          });
          continue;
        }

        if (measuredGapMm < requiredGapMm) {
          const severity = source === 'vendor' ? 'warning' : 'error';
          issues.push({
            severity,
            code: 'STONE_TIGHT_GAP',
            message: `Stones "${a.id}" and "${b.id}" are ${measuredGapMm.toFixed(3)} mm apart (minimum ${requiredGapMm.toFixed(3)} mm).`,
            stoneIds: [a.id, b.id],
            measuredGapMm,
            requiredGapMm,
          });
        }
      }
    }
  }

  const valid = issues.every((issue) => issue.severity !== 'error');
  return { valid, issues };
}
