import type { MeshWarning, PatternWarning, Solid } from '@/src/lib/papercraft-engine';
import type { TranslateVars } from '../lib/i18n';

type T = (text: string, vars?: TranslateVars) => string;

export interface WarningLine {
  tone: 'info' | 'warning';
  text: string;
}

/** Plain-language text for what the engine found in the mesh (in the reader's language). */
export function describeMeshWarning(t: T, w: MeshWarning): WarningLine {
  const count = w.count ?? 0;
  switch (w.code) {
    case 'degenerate-faces-removed':
      return { tone: 'info', text: t('{count} faces with no area were removed.', { count }) };
    case 'duplicate-faces-removed':
      return { tone: 'info', text: t('{count} duplicate faces were removed.', { count }) };
    case 'nonplanar-face-split':
      return { tone: 'info', text: t('{count} faces that were not flat were split into triangles.', { count }) };
    case 'orientation-fixed':
      return { tone: 'info', text: t('{count} faces faced the wrong way compared to their neighbours and were turned.', { count }) };
    case 'non-orientable':
      return { tone: 'warning', text: t('The surface has no consistent inside and outside (twisted or self-touching). The pattern may be wrong.') };
    case 'inverted-normals-fixed':
      return { tone: 'info', text: t('The model was inside out and has been turned.') };
    case 'multiple-shells':
      return { tone: 'info', text: t('The model is {count} separate pieces.', { count }) };
    case 'open-edges':
      return { tone: 'warning', text: t('The model has {count} open edges (holes). Open edges are cut and not glued.', { count }) };
    case 'non-manifold-edges':
      return { tone: 'warning', text: t('{count} edges are shared by more than two faces and are always cut.', { count }) };
    case 'empty':
      return { tone: 'warning', text: t('The model has no faces.') };
    case 'unused-vertices':
    case 'tiny-faces':
      return { tone: 'info', text: w.message };
  }
}

export function describePatternWarning(t: T, w: PatternWarning): WarningLine | null {
  const count = w.count ?? 0;
  switch (w.code) {
    case 'tab-missing':
      return { tone: 'warning', text: t('{count} edges have no room for a glue tab. Glue those edges edge to edge.', { count }) };
    case 'tab-very-narrow':
      return { tone: 'warning', text: t('{count} glue tabs are very narrow: there is little room there. Use a thin line of glue.', { count }) };
    case 'tab-narrowed':
      return { tone: 'info', text: t('{count} glue tabs are narrower than asked to fit.', { count }) };
    case 'forced-join-overlaps':
      return { tone: 'warning', text: t('{count} joins you asked for were not made because the part would overlap itself or be too big.', { count }) };
    case 'part-too-large':
      return { tone: 'warning', text: t('{count} parts are bigger than the page even after splitting. Make the model smaller or the page bigger.', { count }) };
    case 'non-manifold-edge-cut':
      // Already said by the mesh warning about edges shared by more than two faces.
      return null;
  }
}

export function describeLayoutWarning(t: T, w: PatternWarning): WarningLine {
  return { tone: 'warning', text: t('{count} parts do not fit on a page and were put on pages of their own.', { count: w.count ?? 0 }) };
}

/** Under this an edge is hard to fold and glue by hand. */
export const MIN_COMFORTABLE_EDGE_MM = 8;

/** Warnings that come from the size of the model, not from its shape. `formatLength` writes a length in the unit in use. */
export function describeSizeWarnings(t: T, solid: Solid, formatLength: (mm: number) => string): WarningLine[] {
  if (solid.edges.length === 0) return [];
  const shortest = solid.edges.reduce((m, e) => Math.min(m, e.length), Infinity);
  if (shortest >= MIN_COMFORTABLE_EDGE_MM) return [];
  return [{ tone: 'warning', text: t('The shortest edge is only {size}: too small to fold and glue well. Make the model bigger, or use one with fewer faces.', { size: formatLength(shortest) }) }];
}
