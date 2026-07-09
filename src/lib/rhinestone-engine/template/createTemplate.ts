import type { RhinestoneTemplate, Stone } from '../types/index';

// ─── Input type ───────────────────────────────────────────────────────────────

export interface CreateRhinestoneTemplateInput {
  id: string;
  name: string;
  stones: Stone[];
  widthMm?: number;
  heightMm?: number;
  metadata?: Record<string, string | number | boolean>;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function assertNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`createRhinestoneTemplate: "${field}" must be a non-empty string.`);
  }
}

function validateStones(stones: Stone[]): void {
  const seen = new Set<string>();

  for (let i = 0; i < stones.length; i++) {
    const stone = stones[i]!;

    if (typeof stone.id !== 'string' || stone.id.trim().length === 0) {
      throw new Error(
        `createRhinestoneTemplate: stone at index ${i} has an empty or missing id.`,
      );
    }

    if (seen.has(stone.id)) {
      throw new Error(
        `createRhinestoneTemplate: duplicate stone id "${stone.id}" at index ${i}.`,
      );
    }
    seen.add(stone.id);

    if (
      typeof stone.center?.x !== 'number' ||
      !isFinite(stone.center.x) ||
      typeof stone.center?.y !== 'number' ||
      !isFinite(stone.center.y)
    ) {
      throw new Error(
        `createRhinestoneTemplate: stone "${stone.id}" has invalid center coordinates ` +
          `(x=${stone.center?.x}, y=${stone.center?.y}). Both must be finite numbers.`,
      );
    }

    if (typeof stone.holeDiameterMm !== 'number' || stone.holeDiameterMm <= 0) {
      throw new Error(
        `createRhinestoneTemplate: stone "${stone.id}" has invalid holeDiameterMm ` +
          `(${stone.holeDiameterMm}). Must be a positive number.`,
      );
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a validated RhinestoneTemplate from the given input.
 *
 * Throws a descriptive error if any input is invalid. This is the safe
 * entry point for creating templates before they are exported to SVG.
 *
 * The returned template:
 * - Always has `unit: "mm"`.
 * - Preserves stone order exactly as provided.
 * - Is a new object — the input is not mutated.
 */
export function createRhinestoneTemplate(
  input: CreateRhinestoneTemplateInput,
): RhinestoneTemplate {
  assertNonEmptyString(input.id, 'id');
  assertNonEmptyString(input.name, 'name');

  if (!Array.isArray(input.stones)) {
    throw new Error(
      `createRhinestoneTemplate: "stones" must be an array, got ${typeof input.stones}.`,
    );
  }

  validateStones(input.stones);

  // Shallow-copy stones array (stones themselves are not mutated)
  const stones: Stone[] = input.stones.map((s) => ({ ...s }));

  const template: RhinestoneTemplate = {
    id: input.id,
    name: input.name,
    unit: 'mm',
    stones,
  };

  if (input.widthMm !== undefined) template.widthMm = input.widthMm;
  if (input.heightMm !== undefined) template.heightMm = input.heightMm;
  if (input.metadata !== undefined) template.metadata = { ...input.metadata };

  return template;
}
