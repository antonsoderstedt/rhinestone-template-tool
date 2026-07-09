import { describe, it, expect } from 'vitest';
import {
  validateRhinestoneTemplate,
  createRhinestoneTemplate,
  createStoneGridTemplate,
} from '../src/lib/rhinestone-engine/index.js';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeStone(overrides: Partial<Stone> = {}): Stone {
  return {
    id: 'stone-1',
    center: { x: 10, y: 10 },
    stoneSize: 'SS10',
    holeDiameterMm: 3.0,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<RhinestoneTemplate> = {}): RhinestoneTemplate {
  return {
    id: 'tpl-1',
    name: 'Clean Template',
    unit: 'mm',
    stones: [
      makeStone({ id: 's1', center: { x: 0, y: 0 } }),
      makeStone({ id: 's2', center: { x: 20, y: 0 } }),
    ],
    ...overrides,
  };
}

// ─── Valid template ───────────────────────────────────────────────────────────

describe('validateRhinestoneTemplate — valid template', () => {
  it('returns valid: true for a clean template', () => {
    const result = validateRhinestoneTemplate(makeTemplate());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns valid: true for an empty stones array', () => {
    const result = validateRhinestoneTemplate(makeTemplate({ stones: [] }));
    expect(result.valid).toBe(true);
  });
});

// ─── Unit check ───────────────────────────────────────────────────────────────

describe('validateRhinestoneTemplate — unit', () => {
  it('returns error for template.unit !== "mm"', () => {
    const bad = { ...makeTemplate(), unit: 'in' } as unknown as RhinestoneTemplate;
    const result = validateRhinestoneTemplate(bad);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'INVALID_UNIT')).toBe(true);
  });
});

// ─── id / name ────────────────────────────────────────────────────────────────

describe('validateRhinestoneTemplate — id and name', () => {
  it('returns error for empty template id', () => {
    const result = validateRhinestoneTemplate(makeTemplate({ id: '' }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'EMPTY_ID')).toBe(true);
  });

  it('returns error for empty template name', () => {
    const result = validateRhinestoneTemplate(makeTemplate({ name: '' }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'EMPTY_NAME')).toBe(true);
  });
});

// ─── Hole diameter ────────────────────────────────────────────────────────────

describe('validateRhinestoneTemplate — hole diameter', () => {
  it('returns error for stone with holeDiameterMm === 0', () => {
    const stones = [makeStone({ id: 's1', holeDiameterMm: 0 })];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'INVALID_HOLE_DIAMETER')).toBe(true);
  });

  it('includes the offending stone id in the issue', () => {
    const stones = [makeStone({ id: 'bad-stone', holeDiameterMm: -1 })];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    const issue = result.issues.find((i) => i.code === 'INVALID_HOLE_DIAMETER');
    expect(issue?.stoneIds).toContain('bad-stone');
  });
});

// ─── Duplicate IDs ────────────────────────────────────────────────────────────

describe('validateRhinestoneTemplate — duplicate stone ids', () => {
  it('returns error for duplicate stone ids when requireUniqueStoneIds is true (default)', () => {
    const stones = [makeStone({ id: 'dup' }), makeStone({ id: 'dup' })];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_STONE_ID')).toBe(true);
  });

  it('allows duplicate stone ids when requireUniqueStoneIds is false', () => {
    const stones = [makeStone({ id: 'dup' }), makeStone({ id: 'dup' })];
    // Stones are far apart so no collision
    stones[1]!.center = { x: 100, y: 100 };
    const result = validateRhinestoneTemplate(makeTemplate({ stones }), {
      requireUniqueStoneIds: false,
    });
    expect(result.issues.every((i) => i.code !== 'DUPLICATE_STONE_ID')).toBe(true);
  });
});

// ─── Collision detection ──────────────────────────────────────────────────────

describe('validateRhinestoneTemplate — collision detection', () => {
  it('returns error for overlapping stones when requireNoCollisions is true (default)', () => {
    // Two SS10 stones 1mm apart — way too close (hole radius 1.5mm each)
    const stones = [
      makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 's2', center: { x: 1, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'STONE_COLLISION')).toBe(true);
  });

  it('collision issue includes both stone IDs', () => {
    const stones = [
      makeStone({ id: 'a', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 'b', center: { x: 1, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    const collision = result.issues.find((i) => i.code === 'STONE_COLLISION');
    expect(collision?.stoneIds).toContain('a');
    expect(collision?.stoneIds).toContain('b');
  });

  it('returns valid for stones with sufficient spacing', () => {
    // Center distance of 20mm — far more than needed
    const stones = [
      makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 's2', center: { x: 20, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    expect(result.valid).toBe(true);
  });

  it('allows overlapping stones when requireNoCollisions is false', () => {
    const stones = [
      makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 's2', center: { x: 1, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }), {
      requireNoCollisions: false,
    });
    expect(result.issues.every((i) => i.code !== 'STONE_COLLISION')).toBe(true);
  });
});

// ─── Integration: createRhinestoneTemplate → validate ─────────────────────────

describe('validateRhinestoneTemplate — integration with createRhinestoneTemplate', () => {
  it('validates a template created with createRhinestoneTemplate', () => {
    const t = createRhinestoneTemplate({
      id: 'v1',
      name: 'Valid',
      stones: [
        makeStone({ id: 's1', center: { x: 0, y: 0 } }),
        makeStone({ id: 's2', center: { x: 20, y: 0 } }),
      ],
    });
    expect(validateRhinestoneTemplate(t).valid).toBe(true);
  });
});

// ─── Integration: createStoneGridTemplate → validate ──────────────────────────

describe('validateRhinestoneTemplate — integration with createStoneGridTemplate', () => {
  it('grid template passes validation', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 4,
      rows: 3,
    });
    const result = validateRhinestoneTemplate(t);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
