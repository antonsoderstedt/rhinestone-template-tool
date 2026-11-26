import { describe, expect, it } from 'vitest';
import { defaultPart, longestSide, meshOfRecipe, recipeOfTemplate, PART_LIMITS, type ModelRecipe } from '../src/lib/papercraft-engine';
import { computePapercraft } from '../app/papercraft/papercraftCompute';
import { initialPapercraftState, papercraftReducer, type PapercraftState } from '../app/papercraft/papercraftState';
import { deserializePapercraft, serializePapercraft } from '../app/papercraft/papercraftSnapshot';

function built(recipe: ModelRecipe, name = 'Test'): PapercraftState {
  const mesh = meshOfRecipe(recipe)!;
  return papercraftReducer(initialPapercraftState(), { type: 'USE_RECIPE', name, recipe, mesh, sizeMm: longestSide(mesh) });
}

describe('building your own model: state', () => {
  it('a new recipe becomes the model, with its own size, and clears what belonged to the old model', () => {
    const start = { ...initialPapercraftState(), edits: { forceCut: [1, 2], forceJoin: [3] }, layout: { ...initialPapercraftState().layout, pins: { 1: { page: 0, rotation: 0, x: 0, y: 0, w: 1, h: 1 } } } };
    const recipe = recipeOfTemplate('house')!;
    const mesh = meshOfRecipe(recipe)!;
    const state = papercraftReducer(start, { type: 'USE_RECIPE', name: 'House', recipe, mesh, sizeMm: longestSide(mesh) });
    expect(state.source.kind).toBe('file');
    expect(state.source.kind === 'file' && state.source.recipe).toEqual(recipe);
    expect(state.projectName).toBe('House');
    expect(state.size).toEqual({ by: 'largest', mm: Math.round(longestSide(mesh) * 100) / 100 });
    expect(state.edits).toEqual({ forceCut: [], forceJoin: [] });
    expect(state.layout.pins).toEqual({});
  });

  it('changing the recipe keeps the name and the paper, and replaces the mesh', () => {
    const first = built(recipeOfTemplate('pencil-cup')!, 'My cup');
    const wider: ModelRecipe = { kind: 'parametric', templateId: 'pencil-cup', values: { diameter: 150, height: 100, sides: 8 } };
    const mesh = meshOfRecipe(wider)!;
    const next = papercraftReducer({ ...first, paper: { ...first.paper, preset: 'a3' } }, { type: 'SET_RECIPE', recipe: wider, mesh, sizeMm: longestSide(mesh) });
    expect(next.projectName).toBe('My cup');
    expect(next.paper.preset).toBe('a3');
    expect(next.source.kind === 'file' && next.source.mesh).toBe(mesh);
    expect(next.size.mm).toBeCloseTo(150, 0);
  });

  it('ignores a change of recipe when the model is a built-in one', () => {
    const state = initialPapercraftState();
    const recipe = recipeOfTemplate('house')!;
    expect(papercraftReducer(state, { type: 'SET_RECIPE', recipe, mesh: meshOfRecipe(recipe)!, sizeMm: 100 })).toBe(state);
  });

  it('a size that is not a number or is out of range falls back to something workable', () => {
    const recipe = recipeOfTemplate('house')!;
    const mesh = meshOfRecipe(recipe)!;
    expect(papercraftReducer(initialPapercraftState(), { type: 'USE_RECIPE', name: 'x', recipe, mesh, sizeMm: NaN }).size.mm).toBe(100);
    expect(papercraftReducer(initialPapercraftState(), { type: 'USE_RECIPE', name: 'x', recipe, mesh, sizeMm: 1e6 }).size.mm).toBe(3000);
  });

  it('every template makes a pattern in the studio', () => {
    for (const id of ['box-with-lid', 'pencil-cup', 'house', 'tower', 'cake']) {
      const result = computePapercraft(built(recipeOfTemplate(id)!));
      expect(result.ok, id).toBe(true);
      if (result.ok) expect(result.run.pattern.parts.length, id).toBeGreaterThan(0);
    }
  });
});

describe('building your own model: saving', () => {
  it('a model built from a template is saved with its recipe and comes back with it', () => {
    const recipe: ModelRecipe = { kind: 'parametric', templateId: 'tower', values: { base: 80, top: 40, height: 150, point: 60, sides: 6 } };
    const back = deserializePapercraft(JSON.parse(JSON.stringify(serializePapercraft(built(recipe)))));
    expect(back?.source.kind === 'file' && back.source.recipe).toEqual(recipe);
  });

  it('a model built from parts is saved with its parts', () => {
    const recipe: ModelRecipe = { kind: 'parts', parts: [defaultPart('box'), { ...defaultPart('cone'), z: 40 }] };
    const back = deserializePapercraft(JSON.parse(JSON.stringify(serializePapercraft(built(recipe)))));
    expect(back?.source.kind === 'file' && back.source.recipe).toEqual(recipe);
  });

  it('a design saved before there were recipes still opens, without one', () => {
    const saved = JSON.parse(JSON.stringify(serializePapercraft(built(recipeOfTemplate('house')!))));
    delete saved.source.recipe;
    const back = deserializePapercraft(saved);
    expect(back?.source.kind).toBe('file');
    expect(back?.source.kind === 'file' && back.source.recipe).toBeUndefined();
  });

  it('a damaged recipe is left out and the saved model still opens; numbers out of range are brought back', () => {
    const saved = JSON.parse(JSON.stringify(serializePapercraft(built({ kind: 'parts', parts: [defaultPart('box')] }))));
    for (const bad of [{ kind: 'parts', parts: [{ kind: 'box' }] }, { kind: 'parametric', templateId: 'gone', values: {} }, { kind: 'parts', parts: [] }, 'text', null]) {
      const copy = JSON.parse(JSON.stringify(saved));
      copy.source.recipe = bad;
      const back = deserializePapercraft(copy);
      expect(back, JSON.stringify(bad)).not.toBeNull();
      expect(back?.source.kind === 'file' && back.source.recipe, JSON.stringify(bad)).toBeUndefined();
    }
    const wild = JSON.parse(JSON.stringify(saved));
    wild.source.recipe.parts[0].width = 1e9;
    const back = deserializePapercraft(wild);
    expect(back?.source.kind === 'file' && back.source.recipe?.kind === 'parts' && back.source.recipe.parts[0]!.width).toBe(PART_LIMITS.size.max);
    const values = JSON.parse(JSON.stringify(serializePapercraft(built(recipeOfTemplate('cake')!))));
    values.source.recipe.values.tiers = 99;
    const backTiers = deserializePapercraft(values);
    expect(backTiers?.source.kind === 'file' && backTiers.source.recipe?.kind === 'parametric' && backTiers.source.recipe.values.tiers).toBe(6);
  });
});
