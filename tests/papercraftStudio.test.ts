import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSolid, reportSolid, shapes } from '../src/lib/papercraft-engine';
import type { MeshWarning, PatternWarning } from '../src/lib/papercraft-engine';
import { translate } from '../app/lib/i18n';
import { BUILT_IN_MODELS } from '../app/papercraft/papercraftModels';
import { initialPapercraftState, papercraftReducer, type PapercraftState } from '../app/papercraft/papercraftState';
import { computePapercraft, MAX_FACES } from '../app/papercraft/papercraftCompute';
import { describeLayoutWarning, describeMeshWarning, describePatternWarning } from '../app/papercraft/papercraftWarnings';
import { buildCricutDownload, buildCricutSvgs, buildPdfDownload, exportBaseName } from '../app/papercraft/papercraftExport';
import { MAX_MODEL_FILE_BYTES, ModelFileError, object3dToRawMesh, readModelFile } from '../app/papercraft/papercraftFiles';

const start = (): PapercraftState => initialPapercraftState();
const t = (text: string, vars?: Record<string, string | number>) => translate('en', text, vars);
const sv = (text: string, vars?: Record<string, string | number>) => translate('sv', text, vars);

describe('papercraft studio state', () => {
  it('starts on the test cube with the pattern shown', () => {
    const s = start();
    expect(s.source).toEqual({ kind: 'builtin', id: 'test-cube' });
    expect(s.view).toBe('pattern');
    expect(s.fold).toBe(1);
  });

  it('choosing a built-in model resets size, hand edits and selection', () => {
    let s = papercraftReducer(start(), { type: 'TOGGLE_EDGE', edgeId: 3, joined: true });
    s = papercraftReducer(s, { type: 'SELECT_PART', partId: 2 });
    s = papercraftReducer(s, { type: 'USE_BUILT_IN', id: 'icosahedron' });
    expect(s.source).toEqual({ kind: 'builtin', id: 'icosahedron' });
    expect(s.edits).toEqual({ forceCut: [], forceJoin: [] });
    expect(s.selectedPartId).toBeNull();
    expect(s.size.mm).toBe(90);
    expect(papercraftReducer(s, { type: 'USE_BUILT_IN', id: 'nope' })).toBe(s);
  });

  it('a file becomes the model and the project is named after it', () => {
    const s = papercraftReducer(start(), { type: 'USE_FILE', fileName: 'my fox.obj', mesh: shapes.cube(1) });
    expect(s.projectName).toBe('my fox');
    expect(s.source.kind).toBe('file');
    expect(s.size).toEqual({ by: 'largest', mm: 100 });
  });

  it('clicking an edge cuts a fold and folds a cut, and the last click wins', () => {
    let s = papercraftReducer(start(), { type: 'TOGGLE_EDGE', edgeId: 4, joined: true });
    expect(s.edits).toEqual({ forceCut: [4], forceJoin: [] });
    s = papercraftReducer(s, { type: 'TOGGLE_EDGE', edgeId: 4, joined: false });
    expect(s.edits).toEqual({ forceCut: [], forceJoin: [4] });
    s = papercraftReducer(s, { type: 'TOGGLE_EDGE', edgeId: 4, joined: true });
    expect(s.edits).toEqual({ forceCut: [4], forceJoin: [] });
    expect(papercraftReducer(s, { type: 'RESET_EDITS' }).edits).toEqual({ forceCut: [], forceJoin: [] });
  });

  it('ignores a size that is not a positive number and keeps the fold amount between 0 and 1', () => {
    const s = start();
    expect(papercraftReducer(s, { type: 'SET_SIZE', size: { mm: 0 } })).toBe(s);
    expect(papercraftReducer(s, { type: 'SET_SIZE', size: { mm: NaN } })).toBe(s);
    expect(papercraftReducer(s, { type: 'SET_SIZE', size: { mm: 120 } }).size.mm).toBe(120);
    expect(papercraftReducer(s, { type: 'SET_FOLD', fold: 3 }).fold).toBe(1);
    expect(papercraftReducer(s, { type: 'SET_FOLD', fold: -1 }).fold).toBe(0);
  });

  it('switching view or fold does not touch the inputs that decide the pattern', () => {
    const s = start();
    const next = papercraftReducer(papercraftReducer(s, { type: 'SET_VIEW', view: 'model' }), { type: 'SET_FOLD', fold: 0.3 });
    for (const key of ['source', 'size', 'paper', 'pattern', 'edits'] as const) expect(next[key]).toBe(s[key]);
  });
});

describe('papercraft studio computation', () => {
  it('the test cube is one part on one page, 40 mm', () => {
    const r = computePapercraft(start());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.run.pattern.stats.partCount).toBe(1);
    expect(r.run.layout.pages).toHaveLength(1);
    const size = reportSolid(r.run.solid).size;
    expect(Math.max(...size)).toBeCloseTo(40, 6);
  });

  it.each(BUILT_IN_MODELS.map((m) => [m.id, m] as const))('built-in model %s builds and every face lands on a page', (_id, model) => {
    const r = computePapercraft({ ...start(), source: { kind: 'builtin', id: model.id }, size: { by: 'largest', mm: model.defaultSizeMm } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const placedParts = r.run.layout.pages.flatMap((p) => p.placements.map((pl) => pl.partId)).sort((a, b) => a - b);
    expect(placedParts).toEqual(r.run.pattern.parts.map((p) => p.id));
    expect(r.run.solid.closed).toBe(true);
    expect(r.run.layout.warnings).toEqual([]);
  });

  it('a hand edit changes the pattern: cutting a fold of the cube gives a different net', () => {
    const base = computePapercraft(start());
    if (!base.ok) throw new Error('no run');
    const joined = base.run.pattern.joinedEdgeIds[0];
    const edited = computePapercraft(papercraftReducer(start(), { type: 'TOGGLE_EDGE', edgeId: joined, joined: true }));
    if (!edited.ok) throw new Error('no run');
    expect(edited.run.pattern.joinedEdgeIds).not.toContain(joined);
    // Still a spanning forest, and every edge that is not folded is glued.
    const { stats, edgePairCount } = edited.run.pattern;
    expect(stats.foldCount).toBe(stats.faceCount - stats.partCount);
    expect(edgePairCount).toBe(edited.run.solid.edges.length - stats.foldCount);
  });

  it('a smaller page makes more pages', () => {
    const a4 = computePapercraft({ ...start(), source: { kind: 'builtin', id: 'dodecahedron' }, size: { by: 'largest', mm: 160 } });
    const mat = computePapercraft({ ...start(), source: { kind: 'builtin', id: 'dodecahedron' }, size: { by: 'largest', mm: 160 }, paper: { preset: 'cricut12x12', marginMm: 5, gapMm: 3 } });
    if (!a4.ok || !mat.ok) throw new Error('no run');
    expect(a4.run.layout.pages.length).toBeGreaterThanOrEqual(mat.run.layout.pages.length);
  });

  it('refuses a model with too many faces instead of freezing, and reports an unknown model and a broken model', () => {
    const faces = Array.from({ length: MAX_FACES * 2 + 1 }, () => [0, 1, 2]);
    const big = computePapercraft({ ...start(), source: { kind: 'file', fileName: 'big.obj', mesh: { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces } } });
    expect(big).toMatchObject({ ok: false, reason: 'too-many-faces' });
    expect(computePapercraft({ ...start(), source: { kind: 'builtin', id: 'nope' } })).toMatchObject({ ok: false, reason: 'unknown-model' });
    expect(computePapercraft({ ...start(), source: { kind: 'file', fileName: 'x.obj', mesh: { positions: [], faces: [] } } })).toMatchObject({ ok: false });
  });

  it('is deterministic', () => {
    const a = computePapercraft(start());
    const b = computePapercraft(start());
    if (!a.ok || !b.ok) throw new Error('no run');
    expect(JSON.stringify(a.run.layout)).toBe(JSON.stringify(b.run.layout));
  });
});

describe('papercraft warning texts', () => {
  const meshCodes: MeshWarning['code'][] = ['degenerate-faces-removed', 'duplicate-faces-removed', 'nonplanar-face-split', 'orientation-fixed', 'non-orientable', 'inverted-normals-fixed', 'multiple-shells', 'open-edges', 'non-manifold-edges', 'empty', 'unused-vertices', 'tiny-faces'];
  const patternCodes: PatternWarning['code'][] = ['tab-missing', 'tab-narrowed', 'forced-join-overlaps', 'part-too-large', 'non-manifold-edge-cut'];

  it('every mesh warning has text in both languages with its count filled in', () => {
    for (const code of meshCodes) {
      const line = describeMeshWarning(t, { code, count: 7, message: 'engine text' });
      expect(line.text.length, code).toBeGreaterThan(0);
      expect(line.text, code).not.toMatch(/\{\w+\}/);
      const swedish = describeMeshWarning(sv, { code, count: 7, message: 'engine text' });
      if (code !== 'unused-vertices' && code !== 'tiny-faces') expect(swedish.text, code).not.toBe(line.text);
    }
  });

  it('every pattern warning has text in both languages, except the one the mesh warning already says', () => {
    for (const code of patternCodes) {
      const line = describePatternWarning(t, { code, count: 3, message: 'engine text' });
      if (code === 'non-manifold-edge-cut') {
        expect(line).toBeNull();
        continue;
      }
      expect(line!.text).toContain(code === 'part-too-large' ? '3 parts' : '3');
      expect(describePatternWarning(sv, { code, count: 3, message: '' })!.text).not.toBe(line!.text);
    }
    expect(describeLayoutWarning(sv, { code: 'part-too-large', count: 2, message: '' }).text).toContain('2');
  });
});

describe('papercraft downloads', () => {
  const run = (() => {
    const r = computePapercraft(start());
    if (!r.ok) throw new Error('no run');
    return r.run;
  })();
  const multi = (() => {
    const r = computePapercraft({ ...start(), source: { kind: 'builtin', id: 'icosahedron' }, size: { by: 'largest', mm: 150 } });
    if (!r.ok) throw new Error('no run');
    return r.run;
  })();

  it('makes safe file names', () => {
    expect(exportBaseName('  My fox: v2 / final?  ')).toBe('My-fox-v2-final');
    expect(exportBaseName('')).toBe('papercraft');
    expect(exportBaseName('.hidden')).toBe('hidden');
    expect(exportBaseName('a'.repeat(200)).length).toBe(80);
  });

  it('a PDF download is a PDF named after the project', () => {
    const f = buildPdfDownload(run, 'Test cube');
    expect(f.fileName).toBe('Test-cube.pdf');
    expect(f.mime).toBe('application/pdf');
    expect(new TextDecoder().decode((f.data as Uint8Array).slice(0, 8))).toBe('%PDF-1.4');
  });

  it('one page gives one SVG, several pages give a zip of SVGs', () => {
    const one = buildCricutDownload(run, 'Test cube');
    expect(one.fileName).toBe('Test-cube-cricut.svg');
    expect(one.mime).toBe('image/svg+xml');
    expect(one.data as string).toContain('width="210mm"');
    expect(multi.layout.pages.length).toBeGreaterThan(1);
    const many = buildCricutDownload(multi, 'Ball');
    expect(many.fileName).toBe('Ball-cricut.zip');
    const bytes = many.data as Uint8Array;
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    const names = buildCricutSvgs(multi, 'Ball').map((s) => s.name);
    expect(names).toEqual(multi.layout.pages.map((_, i) => `Ball-cricut-page-${i + 1}.svg`));
  });

  it('the Cricut SVG has cut, score and draw layers and nothing Design Space cannot take', () => {
    const svg = buildCricutSvgs(run, 'x')[0].svg;
    for (const id of ['cut', 'score', 'numbers']) expect(svg).toContain(`id="${id}"`);
    expect(svg).not.toMatch(/<use|<image|<canvas|opacity|<text|<svg[\s\S]*<svg/);
  });
});

describe('model files', () => {
  it('collects a three.js scene into one mesh and turns it upright (y up becomes z up)', () => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 4));
    box.position.set(10, 0, 0);
    const group = new THREE.Group();
    group.add(box);
    const mesh = object3dToRawMesh(group);
    const solid = buildSolid(mesh);
    expect(solid.faces).toHaveLength(6);
    expect(solid.closed).toBe(true);
    const size = reportSolid(solid).size;
    expect(size[0]).toBeCloseTo(2, 6);
    expect(size[1]).toBeCloseTo(4, 6);
    expect(size[2]).toBeCloseTo(6, 6);
  });

  it('keeps the outside outside when a scene is scaled or mirrored', () => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    box.scale.set(5, 5, 5);
    const solid = buildSolid(object3dToRawMesh(box));
    expect(solid.faces).toHaveLength(6);
    expect(solid.faces.every((f) => f.area > 24.9 && f.area < 25.1)).toBe(true);
  });

  it('reads an OBJ file and refuses the wrong kinds of file', async () => {
    const obj = ['v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'v 0 0 1', 'f 1 3 2', 'f 1 2 4', 'f 2 3 4', 'f 3 1 4'].join('\n');
    const ok = await readModelFile(new File([obj], 'tetra.obj'));
    expect(ok.fileName).toBe('tetra.obj');
    expect(ok.mesh.faces).toHaveLength(4);
    await expect(readModelFile(new File(['x'], 'model.fbx'))).rejects.toMatchObject({ code: 'unsupported' });
    await expect(readModelFile(new File(['v 1 2 3'], 'empty.obj'))).rejects.toMatchObject({ code: 'unreadable' });
    await expect(readModelFile(new File(['not a model'], 'bad.glb'))).rejects.toBeInstanceOf(ModelFileError);
    const huge = { size: MAX_MODEL_FILE_BYTES + 1, name: 'huge.stl', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    await expect(readModelFile(huge)).rejects.toMatchObject({ code: 'too-big' });
  });
});

function minimalGlb(): ArrayBuffer {
  // One triangle: positions only.
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const json = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [0, 0, 5] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  });
  const pad = (n: number) => (4 - (n % 4)) % 4;
  const jsonBytes = new TextEncoder().encode(json + ' '.repeat(pad(json.length)));
  const total = 12 + 8 + jsonBytes.length + 8 + 36;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buf, 20, jsonBytes.length).set(jsonBytes);
  const o = 20 + jsonBytes.length;
  view.setUint32(o, 36, true);
  view.setUint32(o + 4, 0x004e4942, true);
  new Uint8Array(buf, o + 8, 36).set(new Uint8Array(positions.buffer));
  return buf;
}

describe('GLB files', () => {
  it('reads a GLB (the node transform applied, y up turned to z up)', async () => {
    const { mesh } = await readModelFile(new File([minimalGlb()], 'tri.glb'));
    expect(mesh.faces).toHaveLength(1);
    // The node sits at z = 5 in glTF; after turning upright that is y = -5, and the triangle's y becomes z.
    expect(mesh.positions.map((p) => p.map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [0, -5, 0],
      [1, -5, 0],
      [0, -5, 1],
    ]);
  });
});

describe('texts in both languages', () => {
  it('the built-in model names and descriptions are translated', () => {
    for (const m of BUILT_IN_MODELS) {
      if (m.name !== 'Pyramid' && m.name !== 'Cube') expect(sv(m.name), m.name).not.toBe(m.name);
      expect(sv(m.description), m.id).not.toBe(m.description);
    }
  });
});
