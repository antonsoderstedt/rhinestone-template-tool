import { describe, it, expect } from 'vitest';
import {
  createEditHistory,
  commitEditedTemplate,
  undoEdit,
  redoEdit,
  findStoneById,
  generateManualStoneId,
  addStoneToTemplate,
  removeStoneFromTemplate,
  applyTemplateEditOperation,
  createStoneAtPoint,
  createStoneGridTemplate,
  validateRhinestoneTemplate,
  checkExportReadiness,
  createBasicSvgExport,
  getRecommendedHoleDiameter,
} from '../src/lib/rhinestone-engine/index.js';
import type { Stone } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const BASE = createStoneGridTemplate({
  id: 'editor-test',
  name: 'Editor Test',
  stoneSize: 'SS10',
  columns: 3,
  rows: 2,
});

function makeStone(id: string, x = 5, y = 5): Stone {
  return { id, center: { x, y }, stoneSize: 'SS10', holeDiameterMm: 3.0 };
}

// ─── createEditHistory ────────────────────────────────────────────────────────

describe('createEditHistory', () => {
  it('creates history with empty past and future', () => {
    const h = createEditHistory(BASE);
    expect(h.past).toHaveLength(0);
    expect(h.future).toHaveLength(0);
    expect(h.present).toBe(BASE);
  });
});

// ─── addStoneToTemplate ───────────────────────────────────────────────────────

describe('addStoneToTemplate', () => {
  it('adds a stone to the template', () => {
    const result = addStoneToTemplate(BASE, makeStone('new-1'));
    expect(result.stones.length).toBe(BASE.stones.length + 1);
    expect(result.stones.at(-1)!.id).toBe('new-1');
  });

  it('does not mutate the original template', () => {
    const originalLen = BASE.stones.length;
    addStoneToTemplate(BASE, makeStone('new-x'));
    expect(BASE.stones.length).toBe(originalLen);
  });

  it('rejects duplicate stone IDs', () => {
    const existingId = BASE.stones[0]!.id;
    expect(() => addStoneToTemplate(BASE, makeStone(existingId))).toThrow(/already exists/i);
  });

  it('rejects invalid holeDiameterMm', () => {
    expect(() =>
      addStoneToTemplate(BASE, { ...makeStone('bad'), holeDiameterMm: 0 }),
    ).toThrow(/holeDiameterMm/);
  });

  it('sets edited metadata on the returned template', () => {
    const result = addStoneToTemplate(BASE, makeStone('m1'));
    expect(result.metadata?.edited).toBe(true);
    expect(result.metadata?.editMode).toBe('manual-stone-editor-v1');
  });
});

// ─── removeStoneFromTemplate ──────────────────────────────────────────────────

describe('removeStoneFromTemplate', () => {
  it('removes a stone by id', () => {
    const idToRemove = BASE.stones[0]!.id;
    const result = removeStoneFromTemplate(BASE, idToRemove);
    expect(result.stones.length).toBe(BASE.stones.length - 1);
    expect(result.stones.some(s => s.id === idToRemove)).toBe(false);
  });

  it('throws for a missing stone id', () => {
    expect(() => removeStoneFromTemplate(BASE, 'does-not-exist')).toThrow(/not found/i);
  });

  it('sets edited metadata', () => {
    const result = removeStoneFromTemplate(BASE, BASE.stones[0]!.id);
    expect(result.metadata?.edited).toBe(true);
  });
});

// ─── findStoneById ────────────────────────────────────────────────────────────

describe('findStoneById', () => {
  it('returns the stone with the given id', () => {
    const id = BASE.stones[1]!.id;
    const found = findStoneById(BASE, id);
    expect(found?.id).toBe(id);
  });

  it('returns undefined for unknown id', () => {
    expect(findStoneById(BASE, 'no-such-id')).toBeUndefined();
  });
});

// ─── generateManualStoneId ────────────────────────────────────────────────────

describe('generateManualStoneId', () => {
  it('returns "manual-1" for a template with no manual stones', () => {
    expect(generateManualStoneId(BASE)).toBe('manual-1');
  });

  it('increments beyond existing manual-N ids', () => {
    const withManual = addStoneToTemplate(BASE, { ...makeStone('manual-1'), id: 'manual-1' });
    const withManual2 = addStoneToTemplate(withManual, { ...makeStone('manual-2'), id: 'manual-2' });
    expect(generateManualStoneId(withManual2)).toBe('manual-3');
  });

  it('respects custom prefix', () => {
    expect(generateManualStoneId(BASE, 'custom')).toBe('custom-1');
  });
});

// ─── createStoneAtPoint ───────────────────────────────────────────────────────

describe('createStoneAtPoint', () => {
  it('creates a stone with recommended hole diameter', () => {
    const stone = createStoneAtPoint({
      template: BASE,
      point: { x: 15, y: 20 },
      stoneSize: 'SS10',
    });
    expect(stone.holeDiameterMm).toBe(getRecommendedHoleDiameter('SS10'));
  });

  it('creates a stone with deterministic id', () => {
    const s1 = createStoneAtPoint({ template: BASE, point: { x: 0, y: 0 }, stoneSize: 'SS10' });
    const s2 = createStoneAtPoint({ template: BASE, point: { x: 0, y: 0 }, stoneSize: 'SS10' });
    expect(s1.id).toBe(s2.id);
  });

  it('creates a stone at the given position', () => {
    const stone = createStoneAtPoint({ template: BASE, point: { x: 12.5, y: 7.3 }, stoneSize: 'SS10' });
    expect(stone.center.x).toBe(12.5);
    expect(stone.center.y).toBe(7.3);
  });
});

// ─── applyTemplateEditOperation ───────────────────────────────────────────────

describe('applyTemplateEditOperation', () => {
  it('supports add-stone', () => {
    const result = applyTemplateEditOperation(BASE, {
      type: 'add-stone',
      stone: makeStone('op-add-1'),
    });
    expect(result.stones.some(s => s.id === 'op-add-1')).toBe(true);
  });

  it('supports remove-stone', () => {
    const idToRemove = BASE.stones[0]!.id;
    const result = applyTemplateEditOperation(BASE, {
      type: 'remove-stone',
      stoneId: idToRemove,
    });
    expect(result.stones.some(s => s.id === idToRemove)).toBe(false);
  });
});

// ─── commitEditedTemplate / undo / redo ───────────────────────────────────────

describe('commitEditedTemplate', () => {
  it('pushes current present to past and sets nextTemplate as present', () => {
    const history = createEditHistory(BASE);
    const next = addStoneToTemplate(BASE, makeStone('h1'));
    const newHistory = commitEditedTemplate(history, next);
    expect(newHistory.past).toHaveLength(1);
    expect(newHistory.past[0]).toBe(BASE);
    expect(newHistory.present).toBe(next);
    expect(newHistory.future).toHaveLength(0);
  });
});

describe('undoEdit', () => {
  it('restores the previous template', () => {
    const h0 = createEditHistory(BASE);
    const step1 = addStoneToTemplate(BASE, makeStone('u1'));
    const h1 = commitEditedTemplate(h0, step1);
    const h2 = undoEdit(h1);
    expect(h2.present).toBe(BASE);
    expect(h2.future).toHaveLength(1);
    expect(h2.future[0]).toBe(step1);
  });

  it('returns the same history when nothing to undo', () => {
    const h = createEditHistory(BASE);
    expect(undoEdit(h)).toBe(h);
  });
});

describe('redoEdit', () => {
  it('re-applies an undone step', () => {
    const h0 = createEditHistory(BASE);
    const step1 = addStoneToTemplate(BASE, makeStone('r1'));
    const h1 = commitEditedTemplate(h0, step1);
    const h2 = undoEdit(h1);
    const h3 = redoEdit(h2);
    expect(h3.present).toBe(step1);
    expect(h3.future).toHaveLength(0);
  });

  it('returns the same history when nothing to redo', () => {
    const h = createEditHistory(BASE);
    expect(redoEdit(h)).toBe(h);
  });
});

// ─── Validation and export integration ───────────────────────────────────────

describe('templateEditor — integration', () => {
  it('edited template passes validateRhinestoneTemplate when no collisions', () => {
    // Add a stone far from existing stones
    const stone = createStoneAtPoint({ template: BASE, point: { x: 200, y: 200 }, stoneSize: 'SS10' });
    const edited = addStoneToTemplate(BASE, stone);
    expect(validateRhinestoneTemplate(edited).valid).toBe(true);
  });

  it('edited template passes checkExportReadiness when valid', () => {
    const stone = createStoneAtPoint({ template: BASE, point: { x: 200, y: 200 }, stoneSize: 'SS10' });
    const edited = addStoneToTemplate(BASE, stone);
    const r = checkExportReadiness(edited, { requireCalibration: false });
    expect(r.ready).toBe(true);
  });

  it('edited template exports through createBasicSvgExport', () => {
    const stone = createStoneAtPoint({ template: BASE, point: { x: 200, y: 200 }, stoneSize: 'SS10' });
    const edited = addStoneToTemplate(BASE, stone);
    expect(() => createBasicSvgExport(edited)).not.toThrow();
  });

  it('exported SVG contains real <circle elements', () => {
    const svg = createBasicSvgExport(BASE);
    expect(svg).toContain('<circle');
  });

  it('exported SVG does not contain <image', () => {
    const svg = createBasicSvgExport(BASE);
    expect(svg).not.toContain('<image');
  });
});
