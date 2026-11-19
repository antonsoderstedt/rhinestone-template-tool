import { describe, expect, it } from 'vitest';
import { STARTER_TEMPLATE_LIBRARY_ENTRIES } from '../src/lib/rhinestone-engine/templateLibrary/starterTemplates';
import {
  InMemoryTemplateLibraryRepository,
  LocalStorageTemplateLibraryRepository,
  parseRhinestoneProject,
  serializeRhinestoneProject,
  validateRhinestoneTemplate,
  type RhinestoneTemplate,
} from '../src/lib/rhinestone-engine/index';
import {
  circleCurve,
  heartCurve,
  sampleClosedCurve,
  samplePolygonEdges,
  starVertices,
  rectangleVertices,
} from '../src/lib/rhinestone-engine/templateLibrary/starterShapes';

function entryTemplate(entryId: string): RhinestoneTemplate {
  const entry = STARTER_TEMPLATE_LIBRARY_ENTRIES.find((item) => item.templateId === entryId)!;
  const project = entry.snapshot.project;
  const stones = project.generatorState.generatorId === 'manual-editor'
    ? project.generatorState.stones
    : [];
  return {
    id: entry.templateId,
    name: entry.name,
    unit: 'mm',
    stones: stones.map((stone) => ({
      id: stone.id,
      center: { x: stone.x, y: stone.y },
      stoneSize: stone.stoneSize,
      holeDiameterMm: stone.holeDiameterMm,
    })),
  };
}

describe('starter template library', () => {
  it('ships a useful set of starters with unique ids, names and real stone counts', () => {
    expect(STARTER_TEMPLATE_LIBRARY_ENTRIES.length).toBeGreaterThanOrEqual(12);
    const ids = STARTER_TEMPLATE_LIBRARY_ENTRIES.map((entry) => entry.templateId);
    expect(new Set(ids).size).toBe(ids.length);

    const newStarters = STARTER_TEMPLATE_LIBRARY_ENTRIES.filter((entry) => !['starter-badge', 'starter-grid', 'starter-chevron'].includes(entry.templateId));
    expect(newStarters.length).toBeGreaterThanOrEqual(10);
    for (const entry of newStarters) {
      expect(entry.stoneCount, entry.name).toBeGreaterThanOrEqual(20);
      expect(entry.builtIn).toBe(true);
      expect(entry.readOnly).toBe(true);
      expect(entry.previewRef, entry.name).toMatch(/^data:image\/svg\+xml/);
      expect(entry.widthMm, entry.name).toBeGreaterThan(0);
      expect(entry.heightMm, entry.name).toBeGreaterThan(0);
    }
  });

  it('covers the categories users look for', () => {
    const tags = new Set(STARTER_TEMPLATE_LIBRARY_ENTRIES.flatMap((entry) => entry.tags));
    for (const wanted of ['name', 'monogram', 'heart', 'star', 'border', 'number', 'scoreboard', 'team']) {
      expect(tags.has(wanted), wanted).toBe(true);
    }
  });

  it('every starter project survives a save / parse round trip', () => {
    for (const entry of STARTER_TEMPLATE_LIBRARY_ENTRIES) {
      const json = serializeRhinestoneProject(entry.snapshot.project);
      const restored = parseRhinestoneProject(json);
      expect(restored.projectName, entry.name).toBe(entry.snapshot.project.projectName);
      expect(restored.generatorState.generatorId, entry.name).toBe(entry.snapshot.project.generatorState.generatorId);
    }
  });

  it('text starters stay editable text projects', () => {
    const name = STARTER_TEMPLATE_LIBRARY_ENTRIES.find((entry) => entry.templateId === 'starter-name')!;
    expect(name.snapshot.project.generatorState).toMatchObject({ generatorId: 'dot-matrix-text', text: 'NAME' });
    expect(name.snapshot.project.activeTool).toBe('text');
  });

  it('shape starters have no overlapping stones and keep the minimum edge gap', () => {
    for (const id of ['starter-heart', 'starter-star', 'starter-circle', 'starter-border', 'starter-diamond']) {
      const result = validateRhinestoneTemplate(entryTemplate(id), { minGapMm: 0.508 });
      const errors = result.issues.filter((issue) => issue.severity === 'error');
      expect(errors, `${id}: ${errors.map((issue) => issue.message).join(' | ')}`).toEqual([]);
    }
  });

  it('is deterministic: building the same starters twice gives identical data', () => {
    const first = JSON.stringify(STARTER_TEMPLATE_LIBRARY_ENTRIES.map((entry) => [entry.templateId, entry.stoneCount, entry.snapshot]));
    const second = JSON.stringify(STARTER_TEMPLATE_LIBRARY_ENTRIES.map((entry) => [entry.templateId, entry.stoneCount, entry.snapshot]));
    expect(first).toBe(second);
    expect(JSON.stringify(sampleClosedCurve(heartCurve(70), 5))).toBe(JSON.stringify(sampleClosedCurve(heartCurve(70), 5)));
  });

  it('the in-memory repository exposes all starters and lets a starter be copied into My Designs', async () => {
    const repository = new InMemoryTemplateLibraryRepository();
    const record = await repository.list();
    expect(record.builtInTemplates.length).toBe(STARTER_TEMPLATE_LIBRARY_ENTRIES.length);

    const copy = await repository.duplicate('starter-heart', 'my-heart', 'My heart');
    expect(copy.builtIn).toBe(false);
    expect(copy.readOnly).toBe(false);
    expect((await repository.list()).userTemplates.map((entry) => entry.templateId)).toContain('my-heart');
  });
});

describe('browser repository keeps starters current', () => {
  it('shows new starters even when an older starter list is already stored', async () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    } as unknown as Storage;
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage, configurable: true });

    try {
      const oldStarters = STARTER_TEMPLATE_LIBRARY_ENTRIES.slice(0, 3).map((entry, index) => ({ ...entry, favorite: index === 1 }));
      store.set('rhinestone-template-library', JSON.stringify({ version: 1, builtInTemplates: oldStarters, userTemplates: [] }));

      const record = await new LocalStorageTemplateLibraryRepository().list();
      expect(record.builtInTemplates.length).toBe(STARTER_TEMPLATE_LIBRARY_ENTRIES.length);
      // The user's favourite choice on a starter is kept.
      expect(record.builtInTemplates.filter((entry) => entry.favorite).map((entry) => entry.templateId)).toEqual([oldStarters[1]!.templateId]);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe('starter shape helpers', () => {
  it('samplePolygonEdges keeps every vertex', () => {
    const points = samplePolygonEdges(rectangleVertices(100, 60), 5);
    for (const corner of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }]) {
      expect(points).toContainEqual(corner);
    }
  });

  it('sampleClosedCurve spaces stones evenly around a circle', () => {
    const points = sampleClosedCurve(circleCurve(70), 5);
    const gaps = points.map((point, index) => {
      const next = points[(index + 1) % points.length]!;
      return Math.hypot(next.x - point.x, next.y - point.y);
    });
    // Chord lengths of an evenly spaced circle are all (nearly) equal.
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.05);
  });

  it('rejects invalid input instead of looping forever', () => {
    expect(() => samplePolygonEdges([{ x: 0, y: 0 }, { x: 1, y: 1 }], 5)).toThrow();
    expect(() => sampleClosedCurve(circleCurve(10), 0)).toThrow();
    expect(starVertices(10)).toHaveLength(10);
  });
});
