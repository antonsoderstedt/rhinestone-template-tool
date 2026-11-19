import { describe, it, expect } from 'vitest';
import {
  validateRhinestoneTemplate,
  createRhinestoneTemplate,
  createStoneGridTemplate,
  resolveStoneSpacing,
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
    expect(result.issues.some((i) => i.code === 'STONE_COLLISION' || i.code === 'STONE_OVERLAP')).toBe(true);
  });

  it('collision issue includes both stone IDs', () => {
    const stones = [
      makeStone({ id: 'a', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 'b', center: { x: 1, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }));
    const collision = result.issues.find((i) => i.code === 'STONE_COLLISION' || i.code === 'STONE_OVERLAP');
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

  it('flags tight gaps as errors for user-generated templates and includes measured values', () => {
    const stones = [
      makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 's2', center: { x: 3.35, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }), { minGapMm: 0.508 });
    const tightGap = result.issues.find((i) => i.code === 'STONE_TIGHT_GAP');
    expect(tightGap?.severity).toBe('error');
    expect(tightGap?.measuredGapMm).toBeCloseTo(0.35, 3);
    expect(tightGap?.requiredGapMm).toBeCloseTo(0.508, 3);
  });

  it('warns, rather than errors, on vendor-authored tight gaps', () => {
    const stones = [
      makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 's2', center: { x: 3.35, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones, source: 'vendor' }), { minGapMm: 0.508 });
    const tightGap = result.issues.find((i) => i.code === 'STONE_TIGHT_GAP');
    expect(tightGap?.severity).toBe('warning');
  });

  it('allows overlapping stones when requireNoCollisions is false', () => {
    const stones = [
      makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
      makeStone({ id: 's2', center: { x: 1, y: 0 }, holeDiameterMm: 3.0 }),
    ];
    const result = validateRhinestoneTemplate(makeTemplate({ stones }), {
      requireNoCollisions: false,
    });
    expect(result.issues.every((i) => i.code !== 'STONE_COLLISION' && i.code !== 'STONE_OVERLAP')).toBe(true);
  });
});

describe('resolveStoneSpacing', () => {
  it('resolves tight gaps and stays idempotent', () => {
    const template = makeTemplate({
      stones: [
        makeStone({ id: 's1', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
        makeStone({ id: 's2', center: { x: 3.35, y: 0 }, holeDiameterMm: 3.0 }),
      ],
    });

    const resolved = resolveStoneSpacing(template, { minGapMm: 0.508 });
    const secondPass = resolveStoneSpacing(resolved, { minGapMm: 0.508 });

    expect(validateRhinestoneTemplate(resolved, { minGapMm: 0.508 }).issues.some((i) => i.code === 'STONE_TIGHT_GAP' || i.code === 'STONE_OVERLAP')).toBe(false);
    expect(secondPass).toEqual(resolved);
  });

  it('deterministically resolves dense grids without leaving below-gap pairs', () => {
    const stones: Stone[] = [];
    const pitch = 3.2;
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 12; col++) {
        stones.push(makeStone({
          id: `dense-${row}-${col}`,
          center: { x: col * pitch, y: row * pitch },
          holeDiameterMm: 3.0,
        }));
      }
    }

    const template = makeTemplate({ stones });
    const resolved = resolveStoneSpacing(template, { minGapMm: 0.508 });
    const secondPass = resolveStoneSpacing(resolved, { minGapMm: 0.508 });
    const validation = validateRhinestoneTemplate(resolved, { minGapMm: 0.508 });

    expect(validation.issues.some((issue) => issue.code === 'STONE_TIGHT_GAP' || issue.code === 'STONE_OVERLAP')).toBe(false);
    expect(secondPass).toEqual(resolved);
    expect(resolved.metadata?.movedStoneCount).toBeGreaterThanOrEqual(0);
    expect(resolved.metadata?.removedStoneCount).toBeGreaterThanOrEqual(0);
  });

  it('keeps dense 426-stone layouts within the minimum gap and reports removals', () => {
    const stones: Stone[] = [];
    const pitch = 3.1;
    let index = 0;
    for (let row = 0; row < 30; row++) {
      for (let col = 0; col < 14; col++) {
        if (stones.length >= 426) break;
        stones.push(makeStone({
          id: `score-${index++}`,
          center: { x: col * pitch, y: row * pitch },
          holeDiameterMm: 3.0,
        }));
      }
    }

    const template = makeTemplate({ stones });
    const resolved = resolveStoneSpacing(template, { minGapMm: 0.354 });
    const validation = validateRhinestoneTemplate(resolved, { minGapMm: 0.354 });

    expect(resolved.stones.length).toBeGreaterThan(0);
    expect(validation.issues.some((issue) => issue.code === 'STONE_TIGHT_GAP' || issue.code === 'STONE_OVERLAP')).toBe(false);
    expect(resolved.metadata?.removedStoneCount ?? 0).toBeGreaterThanOrEqual(0);
    expect(resolved.metadata?.movedStoneCount ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('preserves a dense grid without removals and resolves all tight gaps', () => {
    const stones: Stone[] = [];
    const pitch = 3.2;
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 12; col++) {
        stones.push(makeStone({
          id: `grid-${row}-${col}`,
          center: { x: col * pitch, y: row * pitch },
          holeDiameterMm: 3.0,
        }));
      }
    }

    const template = makeTemplate({ stones });
    const resolved = resolveStoneSpacing(template, { minGapMm: 0.508 });
    const validation = validateRhinestoneTemplate(resolved, { minGapMm: 0.508 });

    expect(resolved.stones.length).toBe(240);
    expect(resolved.metadata?.removedStoneCount ?? 0).toBe(0);
    expect(validation.issues.some((issue) => issue.code === 'STONE_TIGHT_GAP' || issue.code === 'STONE_OVERLAP')).toBe(false);
  });

  it('keeps both stones when they share the same center and resolves deterministically', () => {
    const template = makeTemplate({
      stones: [
        makeStone({ id: 's1', center: { x: 10, y: 10 }, holeDiameterMm: 3.0 }),
        makeStone({ id: 's2', center: { x: 10, y: 10 }, holeDiameterMm: 3.0 }),
      ],
    });

    const resolved = resolveStoneSpacing(template, { minGapMm: 0.508 });
    const validation = validateRhinestoneTemplate(resolved, { minGapMm: 0.508 });

    expect(resolved.stones).toHaveLength(2);
    expect(resolved.metadata?.removedStoneCount ?? 0).toBe(0);
    expect(validation.issues.some((issue) => issue.code === 'STONE_TIGHT_GAP' || issue.code === 'STONE_OVERLAP')).toBe(false);
  });

  it('is idempotent, deterministic, and unchanged for already-valid layouts', () => {
    const valid = makeTemplate({
      stones: [
        makeStone({ id: 'a', center: { x: 0, y: 0 }, holeDiameterMm: 3.0 }),
        makeStone({ id: 'b', center: { x: 20, y: 0 }, holeDiameterMm: 3.0 }),
      ],
    });

    const first = resolveStoneSpacing(valid, { minGapMm: 0.508 });
    const second = resolveStoneSpacing(first, { minGapMm: 0.508 });
    const third = resolveStoneSpacing(valid, { minGapMm: 0.508 });

    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(first.stones.map((stone) => ({ x: stone.center.x, y: stone.center.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it('resolves 1,500 stones deterministically without overlaps or removals', () => {
    const stones: Stone[] = [];
    for (let row = 0; row < 50; row++) {
      for (let col = 0; col < 30; col++) {
        stones.push(makeStone({
          id: `big-${row}-${col}`,
          center: { x: col * 3.2, y: row * 3.2 },
          holeDiameterMm: 3.0,
        }));
      }
    }

    const template = makeTemplate({ stones: stones.slice(0, 1500) });
    const start = performance.now();
    const resolved = resolveStoneSpacing(template, { minGapMm: 0.508 });
    const elapsedMs = performance.now() - start;
    const validation = validateRhinestoneTemplate(resolved, { minGapMm: 0.508 });

    expect(elapsedMs).toBeLessThan(10000);
    expect(validation.issues.some((issue) => issue.code === 'STONE_TIGHT_GAP' || issue.code === 'STONE_OVERLAP')).toBe(false);
    expect(resolved.metadata?.removedStoneCount ?? 0).toBe(0);
    expect(resolved.metadata?.resolutionPasses ?? 0).toBeLessThanOrEqual(500);
    expect(resolved.stones.length).toBeGreaterThan(0);
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
