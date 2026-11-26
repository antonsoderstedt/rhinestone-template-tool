import { extrudeShape, latheShape, type RawMesh, type ShapeRegion } from '@/src/lib/papercraft-engine';
import { importSvgArtwork } from '@/src/lib/rhinestone-engine/svg/svgImport';

/** A flat shape (the gallery's, or an SVG file of the person's own) turned into a 3D model: a box in the shape, or the shape spun round. */

export type ShapeMode = 'box' | 'spun';

export interface ShapeSettings {
  mode: ShapeMode;
  /** Corners of the outline of a box. */
  corners: number;
  /** Depth of the box as a percentage of the longer side of the shape. */
  depthPct: number;
  /** Rings along the height of a spun shape, and sides round it. */
  rings: number;
  sides: number;
}

export const DEFAULT_SHAPE_SETTINGS: ShapeSettings = { mode: 'box', corners: 16, depthPct: 35, rings: 8, sides: 10 };

export const SHAPE_LIMITS = {
  corners: { min: 6, max: 40 },
  depthPct: { min: 10, max: 100 },
  rings: { min: 4, max: 14 },
  sides: { min: 5, max: 16 },
} as const;

/** The biggest SVG file the panel reads. */
export const MAX_SHAPE_SVG_BYTES = 2 * 1024 * 1024;

export class ShapeFileError extends Error {
  constructor(public readonly code: 'too-big' | 'unreadable' | 'empty') {
    super(code);
  }
}

/**
 * The filled regions of an SVG, y up. Shapes that are filled count; a file with only outlines (line art) counts by its closed lines.
 * Throws a `ShapeFileError` when the file is too big, cannot be read as an SVG (or is not safe to), or has nothing to fill.
 */
export function regionsFromSvg(svg: string): ShapeRegion[] {
  if (svg.length > MAX_SHAPE_SVG_BYTES) throw new ShapeFileError('too-big');
  let imported;
  try {
    imported = importSvgArtwork(svg);
  } catch {
    throw new ShapeFileError('unreadable');
  }
  const filled = imported.shapes.filter((s) => s.fill !== null && s.opacity > 0 && s.fillOpacity > 0);
  const used = filled.length > 0 ? filled : imported.shapes;
  const regions: ShapeRegion[] = used
    .map((s) => ({
      fillRule: s.fillRule,
      // The SVG's y points down; the model's up.
      contours: s.polylines.filter((p) => p.points.length >= 3).map((p) => p.points.map((q): [number, number] => [q.x, -q.y])),
    }))
    .filter((r) => r.contours.length > 0);
  if (regions.length === 0) throw new ShapeFileError('empty');
  return regions;
}

export interface ShapeModel {
  mesh: RawMesh;
  /** Separate pieces of the artwork that were left out (the biggest one is the model). */
  omittedPieces: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** The model for these settings, or null when the artwork has nothing to build from. */
export function shapeModel(regions: readonly ShapeRegion[], settings: ShapeSettings): ShapeModel | null {
  const l = SHAPE_LIMITS;
  const made =
    settings.mode === 'box'
      ? extrudeShape(regions, { corners: clamp(settings.corners, l.corners.min, l.corners.max), depthRatio: clamp(settings.depthPct, l.depthPct.min, l.depthPct.max) / 100 })
      : latheShape(regions, { rings: clamp(settings.rings, l.rings.min, l.rings.max), segments: clamp(settings.sides, l.sides.min, l.sides.max) });
  return made ? { mesh: made.mesh, omittedPieces: made.omittedPieces } : null;
}
