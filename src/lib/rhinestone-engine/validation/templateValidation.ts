import type { RhinestoneTemplate } from '../types/index.js';
import { circleToStoneCircle } from '../geometry/circle.js';
import { hasCircleCollisions, findOverlappingCirclePairs } from '../geometry/collision.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateValidationSeverity = 'error' | 'warning';

export interface TemplateValidationIssue {
  severity: TemplateValidationSeverity;
  /** Short machine-readable code for the issue type. */
  code: string;
  message: string;
  /** IDs of the stones involved in the issue (if applicable). */
  stoneIds?: string[];
}

export interface TemplateValidationResult {
  /** True when there are no issues with severity "error". */
  valid: boolean;
  issues: TemplateValidationIssue[];
}

export interface TemplateValidationOptions {
  /**
   * Minimum required gap between hole edges (mm).
   * Passed to collision detection. Default: 0.
   */
  minGapMm?: number;
  /**
   * Require all stone ids to be unique. Default: true.
   */
  requireUniqueStoneIds?: boolean;
  /**
   * Require that no two stone circles overlap. Default: true.
   */
  requireNoCollisions?: boolean;
}

// ─── Resolved options ─────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a RhinestoneTemplate and returns a structured result.
 *
 * A template is `valid` when it has no issues with severity `"error"`.
 * Warnings do not affect validity.
 *
 * Run this before exporting any template to SVG to catch errors early.
 */
export function validateRhinestoneTemplate(
  template: RhinestoneTemplate,
  options: TemplateValidationOptions = {},
): TemplateValidationResult {
  const opts = resolveOptions(options);
  const issues: TemplateValidationIssue[] = [];

  // ── Unit check ─────────────────────────────────────────────────────────────
  if (template.unit !== 'mm') {
    issues.push({
      severity: 'error',
      code: 'INVALID_UNIT',
      message: `template.unit must be "mm", got "${template.unit}". All internal measurements must be in millimeters.`,
    });
  }

  // ── Non-empty id / name ────────────────────────────────────────────────────
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

  // ── Per-stone checks ───────────────────────────────────────────────────────
  const seenIds = new Set<string>();

  for (let i = 0; i < template.stones.length; i++) {
    const stone = template.stones[i]!;

    // Hole diameter
    if (typeof stone.holeDiameterMm !== 'number' || stone.holeDiameterMm <= 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_HOLE_DIAMETER',
        message:
          `Stone "${stone.id}" at index ${i} has invalid holeDiameterMm (${stone.holeDiameterMm}). ` +
          `Must be a positive number.`,
        stoneIds: [stone.id],
      });
    }

    // Duplicate IDs
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

  // ── Collision detection ────────────────────────────────────────────────────
  if (opts.requireNoCollisions && template.stones.length > 1) {
    const circles = template.stones.map(circleToStoneCircle);
    if (hasCircleCollisions(circles, opts.minGapMm)) {
      const pairs = findOverlappingCirclePairs(circles, opts.minGapMm);
      for (const [i, j] of pairs) {
        const idA = template.stones[i]!.id;
        const idB = template.stones[j]!.id;
        issues.push({
          severity: 'error',
          code: 'STONE_COLLISION',
          message:
            `Stones "${idA}" and "${idB}" overlap (indices ${i} and ${j}). ` +
            `Overlapping holes will tear the material.`,
          stoneIds: [idA, idB],
        });
      }
    }
  }

  const valid = issues.every((issue) => issue.severity !== 'error');

  return { valid, issues };
}
