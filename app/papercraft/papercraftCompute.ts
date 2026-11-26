import {
  createPapercraft,
  PAGE_PRESETS,
  type PapercraftResult,
  type RawMesh,
} from '@/src/lib/papercraft-engine';
import { findBuiltInModel } from './papercraftModels';
import type { PapercraftState } from './papercraftState';

/** More faces than this are not unfolded (the unfolding checks every join for overlap and would freeze the page): the studio simplifies the model first. */
export const MAX_FACES = 3000;

/** Where a model over `MAX_FACES` is simplified to when it is imported: a model of this many faces is a good paper model at hand size. */
export const DEFAULT_SIMPLIFY_FACES = 500;
/** The fewest faces the studio asks for: below this a model is no longer recognisable. */
export const MIN_SIMPLIFY_FACES = 12;

export type ComputeResult =
  | { ok: true; run: PapercraftResult }
  | { ok: false; reason: 'unknown-model' | 'too-many-faces' | 'empty' | 'error'; faceCount?: number; detail?: string };

export function meshOfSource(state: Pick<PapercraftState, 'source'>): RawMesh | null {
  if (state.source.kind === 'file') return state.source.mesh;
  return findBuiltInModel(state.source.id)?.mesh() ?? null;
}

/** The part of the studio state that decides the pattern (the view, selection and fold amount do not). */
export type PapercraftInputState = Pick<PapercraftState, 'source' | 'size' | 'paper' | 'pattern' | 'edits'>;

/** Mesh and settings in, pattern and pages out; never throws (a problem comes back as a reason). */
export function computePapercraft(state: PapercraftInputState): ComputeResult {
  const mesh = meshOfSource(state);
  if (!mesh) return { ok: false, reason: 'unknown-model' };
  if (mesh.faces.length > MAX_FACES * 2) return { ok: false, reason: 'too-many-faces', faceCount: mesh.faces.length };
  try {
    const preset = PAGE_PRESETS[state.paper.preset];
    const run = createPapercraft({
      mesh,
      scale: { by: state.size.by, mm: state.size.mm },
      page: { ...preset, marginMm: state.paper.marginMm, gapMm: state.paper.gapMm },
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
