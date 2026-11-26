import {
  createPapercraft,
  PAGE_PRESETS,
  simplifyMesh,
  type PapercraftResult,
  type RawMesh,
} from '@/src/lib/papercraft-engine';
import { findBuiltInModel } from './papercraftModels';
import type { PapercraftState } from './papercraftState';

/** The size of the sheet or mat: a preset, or the one the person typed. */
export function pageSizeOf(paper: PapercraftState['paper']): { pageWidthMm: number; pageHeightMm: number } {
  return paper.preset === 'custom' ? { pageWidthMm: paper.customWidthMm, pageHeightMm: paper.customHeightMm } : PAGE_PRESETS[paper.preset];
}

/** More faces than this are not unfolded (the unfolding checks every join for overlap and would freeze the page): the studio simplifies the model first. */
export const MAX_FACES = 3000;

/** Where a model over `MAX_FACES` is simplified to when it is imported: a model of this many faces is a good paper model at hand size. */
export const DEFAULT_SIMPLIFY_FACES = 500;
/** The fewest faces the studio asks for: below this a model is no longer recognisable. */
export const MIN_SIMPLIFY_FACES = 12;

export type ComputeResult =
  | { ok: true; run: PapercraftResult }
  | { ok: false; reason: 'unknown-model' | 'too-many-faces' | 'empty' | 'error'; faceCount?: number; detail?: string };

export function meshOfSource(state: Pick<PapercraftState, 'source'> & Partial<Pick<PapercraftState, 'detailPct'>>): RawMesh | null {
  if (state.source.kind === 'file') return state.source.mesh;
  const mesh = findBuiltInModel(state.source.id)?.mesh() ?? null;
  const pct = state.detailPct ?? 100;
  if (!mesh || pct >= 100) return mesh;
  // Less detail on a built-in model: fewer faces, by the share asked for. 100 % is what the model is made of once the triangles that only split
  // a flat face are taken away (the simplifier does that first, for free); the share is counted from there.
  const triangles = mesh.faces.reduce((sum, f) => sum + Math.max(1, f.length - 2), 0);
  const base = simplifyMesh(mesh, { targetFaces: triangles });
  return simplifyMesh(base.mesh, { targetFaces: Math.max(MIN_SIMPLIFY_FACES, Math.round((base.outputFaces * pct) / 100)) }).mesh;
}

/** The part of the studio state that decides the pattern (the view, selection and fold amount do not). */
export type PapercraftInputState = Pick<PapercraftState, 'source' | 'size' | 'paper' | 'pattern' | 'edits' | 'detailPct' | 'layout'>;

/** Mesh and settings in, pattern and pages out; never throws (a problem comes back as a reason). */
export function computePapercraft(state: PapercraftInputState): ComputeResult {
  const mesh = meshOfSource(state);
  if (!mesh) return { ok: false, reason: 'unknown-model' };
  if (mesh.faces.length > MAX_FACES * 2) return { ok: false, reason: 'too-many-faces', faceCount: mesh.faces.length };
  try {
    const preset = pageSizeOf(state.paper);
    const run = createPapercraft({
      mesh,
      scale: { by: state.size.by, mm: state.size.mm },
      page: { ...preset, marginMm: state.paper.marginMm, gapMm: state.paper.gapMm },
      layout: { pins: state.layout.pins, maxPartsPerPage: state.layout.maxPartsPerPage ?? undefined, tight: state.layout.tight, calibrationMm: state.layout.calibrationMm ?? undefined },
      pattern: {
        ...state.pattern,
        forceCutEdges: state.edits.forceCut,
        forceJoinEdges: state.edits.forceJoin,
      },
    });
    if (run.solid.faces.length === 0) return { ok: false, reason: 'empty' };
    if (run.solid.faces.length > MAX_FACES) return { ok: false, reason: 'too-many-faces', faceCount: run.solid.faces.length };
    return { ok: true, run };
  } catch (error) {
    return { ok: false, reason: 'error', detail: error instanceof Error ? error.message : String(error) };
  }
}
