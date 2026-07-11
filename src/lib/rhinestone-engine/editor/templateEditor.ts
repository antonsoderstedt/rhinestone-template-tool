/**
 * Manual Stone Editor v1 — Engine functions for add/remove stone operations.
 *
 * All editing logic lives here; React components only orchestrate state
 * and render results.
 *
 * Rules:
 * - Input templates are never mutated.
 * - Stone order is deterministic (additions append; removals preserve order).
 * - Every edited template carries `edited: true` and `editMode` metadata.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId, Point } from '../types/index';
import { getRecommendedHoleDiameter } from '../profiles/materialProfiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateEditOperationType = 'add-stone' | 'remove-stone';

export interface TemplateEditOperation {
  type: TemplateEditOperationType;
  /** Required for "add-stone". */
  stone?: Stone;
  /** Required for "remove-stone". */
  stoneId?: string;
  timestamp?: number;
}

export interface TemplateEditHistory {
  /** Previous states (oldest first). */
  past: RhinestoneTemplate[];
  /** Current state. */
  present: RhinestoneTemplate;
  /** States available for redo (most-recently-undone first). */
  future: RhinestoneTemplate[];
}

export interface TemplateEditorOptions {
  materialProfileId?: string;
  /** Throw if a stone with the same id already exists. Default: true. */
  enforceUniqueStoneIds?: boolean;
}

export interface CreateStoneAtPointOptions {
  template: RhinestoneTemplate;
  point: Point;
  stoneSize: StoneSizeId;
  materialProfileId?: string;
  idPrefix?: string;
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Creates an initial TemplateEditHistory with empty past and future.
 */
export function createEditHistory(template: RhinestoneTemplate): TemplateEditHistory {
  return { past: [], present: template, future: [] };
}

/**
 * Pushes `history.present` onto `past`, sets `nextTemplate` as the new
 * `present`, and clears `future`.
 *
 * Returns a new TemplateEditHistory — input is never mutated.
 */
export function commitEditedTemplate(
  history: TemplateEditHistory,
  nextTemplate: RhinestoneTemplate,
): TemplateEditHistory {
  return {
    past:    [...history.past, history.present],
    present: nextTemplate,
    future:  [],
  };
}

/**
 * Returns a new history that restores the previous state.
 *
 * If there is nothing to undo, returns the same history unchanged.
 */
export function undoEdit(history: TemplateEditHistory): TemplateEditHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1]!;
  return {
    past:    history.past.slice(0, -1),
    present: previous,
    future:  [history.present, ...history.future],
  };
}

/**
 * Returns a new history that re-applies a previously undone state.
 *
 * If there is nothing to redo, returns the same history unchanged.
 */
export function redoEdit(history: TemplateEditHistory): TemplateEditHistory {
  if (history.future.length === 0) return history;
  const next = history.future[0]!;
  return {
    past:    [...history.past, history.present],
    present: next,
    future:  history.future.slice(1),
  };
}

// ─── Stone utilities ──────────────────────────────────────────────────────────

/**
 * Returns the stone with the given id, or `undefined` if not found.
 */
export function findStoneById(
  template: RhinestoneTemplate,
  stoneId: string,
): Stone | undefined {
  return template.stones.find((s) => s.id === stoneId);
}

/**
 * Generates the next available `{prefix}-N` stone id.
 *
 * Scans existing stone ids for the pattern `{prefix}-\d+` and returns
 * `{prefix}-{maxN + 1}`. Deterministic for any given template.
 */
export function generateManualStoneId(
  template: RhinestoneTemplate,
  prefix = 'manual',
): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const stone of template.stones) {
    const m = pattern.exec(stone.id);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${max + 1}`;
}

// ─── Add / remove ─────────────────────────────────────────────────────────────

/**
 * Returns a new template with `stone` appended.
 *
 * @throws if stone.id is empty.
 * @throws if stone.holeDiameterMm <= 0.
 * @throws if stone center coordinates are not finite.
 * @throws if a duplicate stone id exists and enforceUniqueStoneIds is true.
 */
export function addStoneToTemplate(
  template: RhinestoneTemplate,
  stone: Stone,
  options: TemplateEditorOptions = {},
): RhinestoneTemplate {
  const { enforceUniqueStoneIds = true } = options;

  if (typeof stone.id !== 'string' || stone.id.trim().length === 0) {
    throw new Error('addStoneToTemplate: stone.id must be a non-empty string.');
  }
  if (stone.holeDiameterMm <= 0) {
    throw new Error(
      `addStoneToTemplate: holeDiameterMm must be > 0, got ${stone.holeDiameterMm}.`,
    );
  }
  if (!isFinite(stone.center.x) || !isFinite(stone.center.y)) {
    throw new Error(
      `addStoneToTemplate: stone center must have finite x/y coordinates ` +
        `(got x=${stone.center.x}, y=${stone.center.y}).`,
    );
  }
  if (enforceUniqueStoneIds && template.stones.some((s) => s.id === stone.id)) {
    throw new Error(
      `addStoneToTemplate: stone with id "${stone.id}" already exists in the template.`,
    );
  }

  return {
    ...template,
    stones: [...template.stones, { ...stone }],
    metadata: {
      ...template.metadata,
      edited: true,
      editMode: 'manual-stone-editor-v1',
    },
  };
}

/**
 * Returns a new template with the stone identified by `stoneId` removed.
 *
 * @throws if no stone with the given id exists.
 */
export function removeStoneFromTemplate(
  template: RhinestoneTemplate,
  stoneId: string,
): RhinestoneTemplate {
  const exists = template.stones.some((s) => s.id === stoneId);
  if (!exists) {
    throw new Error(
      `removeStoneFromTemplate: stone with id "${stoneId}" not found in the template.`,
    );
  }

  return {
    ...template,
    stones: template.stones.filter((s) => s.id !== stoneId),
    metadata: {
      ...template.metadata,
      edited: true,
      editMode: 'manual-stone-editor-v1',
    },
  };
}

// ─── Operation dispatch ───────────────────────────────────────────────────────

/**
 * Applies a single TemplateEditOperation to a template and returns the result.
 *
 * @throws if required fields are missing for the operation type.
 */
export function applyTemplateEditOperation(
  template: RhinestoneTemplate,
  operation: TemplateEditOperation,
  options?: TemplateEditorOptions,
): RhinestoneTemplate {
  switch (operation.type) {
    case 'add-stone':
      if (!operation.stone) {
        throw new Error(
          'applyTemplateEditOperation: operation.stone is required for "add-stone".',
        );
      }
      return addStoneToTemplate(template, operation.stone, options);

    case 'remove-stone':
      if (!operation.stoneId) {
        throw new Error(
          'applyTemplateEditOperation: operation.stoneId is required for "remove-stone".',
        );
      }
      return removeStoneFromTemplate(template, operation.stoneId);

    default:
      throw new Error(
        `applyTemplateEditOperation: unknown operation type "${String((operation as TemplateEditOperation).type)}".`,
      );
  }
}

// ─── Stone at point ───────────────────────────────────────────────────────────

/**
 * Creates a new Stone at a given position (mm) with a deterministic id.
 *
 * Does NOT add the stone to the template — pass the result to
 * `addStoneToTemplate` when ready.
 */
export function createStoneAtPoint(options: CreateStoneAtPointOptions): Stone {
  const {
    template,
    point,
    stoneSize,
    materialProfileId,
    idPrefix = 'manual',
  } = options;

  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const id = generateManualStoneId(template, idPrefix);

  return {
    id,
    center: { x: point.x, y: point.y },
    stoneSize,
    holeDiameterMm,
  };
}
