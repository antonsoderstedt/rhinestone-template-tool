/**
 * Colour layers of an artwork.
 *
 * The imported shapes are painted onto one grid in document order, the way a viewer draws them: a later shape covers an
 * earlier one, and a hole in a shape shows what is underneath. The result is one mask per colour, which is what the stone
 * layouts work on. A background (a white page, or a shape that covers the whole artwork) is recognised and left out.
 *
 * Pure and deterministic. Lengths in millimetres.
 */

import type { ImportedShape } from '../svg/svgImport';
import type { Polyline } from '../path/polyline';
import {
  boundsOfPolylines,
  createGrid,
  emptyMask,
  fillLoops,
  fillStrokes,
  maskAreaMm2,
  type Grid,
  type GridOptions,
  type Mask,
} from './regionField';

export type LayerRole = 'stones' | 'ignore';

export interface ArtworkLayer {
  /** `#rrggbb`. */
  colour: string;
  mask: Mask;
  areaMm2: number;
  role: LayerRole;
  /** Why the layer is ignored by default, in plain language. */
  reason?: string;
}

export interface BuildLayersOptions {
  /** Scale the artwork to this width (mm). */
  widthMm?: number;
  /** Scale the artwork to this height (mm). With both, the smaller scale is used unless `preserveAspectRatio` is false. */
  heightMm?: number;
  preserveAspectRatio?: boolean;
  /** Top-left corner of the artwork after scaling (mm). Default 10, 10, as for the other generators. */
  originMm?: { x: number; y: number };
  /** Leave out white and a shape that covers the whole artwork. Default true. */
  ignoreBackground?: boolean;
  /** Opacity below which a shape is not painted. Default 0.5. */
  minOpacity?: number;
  grid?: GridOptions;
}

/** A shape of the artwork as drawn, after scaling and placing (mm). For showing the source behind the stones. */
export interface PlacedShape {
  polylines: Polyline[];
  fill: string | null;
  /** Fill opacity times the shape's opacity. */
  fillOpacity: number;
  fillRule: 'nonzero' | 'evenodd';
  stroke: string | null;
  /** After scaling (mm). */
  strokeWidthMm: number;
  strokeOpacity: number;
}

export interface ArtworkLayers {
  layers: ArtworkLayer[];
  grid: Grid;
  /** The factor the file's units were multiplied by. */
  scale: number;
  /** The shapes' outlines after scaling, for measuring the result against the source. */
  polylines: Polyline[];
  /** The shapes as drawn, in document order. Empty for a raster image. */
  placedShapes?: PlacedShape[];
  warnings: string[];
}

const isWhite = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r >= 244 && g >= 244 && b >= 244;
};

export function buildArtworkLayers(shapes: readonly ImportedShape[], options: BuildLayersOptions = {}): ArtworkLayers {
  const { preserveAspectRatio = true, ignoreBackground = true, minOpacity = 0.5 } = options;
  const origin = options.originMm ?? { x: 10, y: 10 };
  const warnings: string[] = [];

  const visible = shapes.filter((shape) => shape.opacity > 0);
  const all = visible.flatMap((shape) => shape.polylines);
  if (all.length === 0) return { layers: [], grid: createGrid({ minX: 0, minY: 0, maxX: 1, maxY: 1 }), scale: 1, polylines: [], warnings: ['Nothing to draw.'] };

  // Bounds of what is actually painted: fills, and strokes with their width.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of visible) {
    const pad = shape.stroke !== null ? shape.strokeWidth / 2 : 0;
    const b = boundsOfPolylines(shape.polylines);
    minX = Math.min(minX, b.minX - pad);
    minY = Math.min(minY, b.minY - pad);
    maxX = Math.max(maxX, b.maxX + pad);
    maxY = Math.max(maxY, b.maxY + pad);
  }
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);

  let scale = 1;
  const byWidth = options.widthMm !== undefined ? options.widthMm / width : undefined;
  const byHeight = options.heightMm !== undefined ? options.heightMm / height : undefined;
  if (byWidth !== undefined && byHeight !== undefined) scale = preserveAspectRatio ? Math.min(byWidth, byHeight) : byWidth;
  else scale = byWidth ?? byHeight ?? 1;

  const place = (polyline: Polyline): Polyline => ({
    ...polyline,
    points: polyline.points.map((p) => ({ x: (p.x - minX) * scale + origin.x, y: (p.y - minY) * scale + origin.y })),
  });
  const placed = visible.map((shape) => ({ shape, polylines: shape.polylines.map(place) }));

  const grid = createGrid(
    { minX: origin.x, minY: origin.y, maxX: origin.x + width * scale, maxY: origin.y + height * scale },
    options.grid,
  );

  // Paint in document order.
  const colourIndex = new Map<string, number>();
  const colours: string[] = [];
  const indexOf = (hex: string) => {
    let i = colourIndex.get(hex);
    if (i === undefined) {
      i = colours.length;
      colourIndex.set(hex, i);
      colours.push(hex);
    }
    return i;
  };
  const owner = new Int16Array(grid.cols * grid.rows).fill(-1);
  const scratch = emptyMask(grid);
  // A background is a first shape that covers the whole artwork. Judged on the shape as drawn, before anything is
  // painted over it, because what is left of it afterwards says nothing.
  let firstShapeCoversAll: string | null = null;
  let painted = 0;
  for (const { shape, polylines } of placed) {
    if (shape.fill !== null && shape.fillOpacity * shape.opacity >= minOpacity) {
      scratch.data.fill(0);
      fillLoops(scratch, polylines, shape.fillRule);
      const index = indexOf(shape.fill);
      if (painted === 0 && maskAreaMm2(scratch) >= width * scale * height * scale * 0.97) firstShapeCoversAll = shape.fill;
      painted++;
      for (let i = 0; i < scratch.data.length; i++) if (scratch.data[i]) owner[i] = index;
    }
    if (shape.stroke !== null && shape.strokeOpacity * shape.opacity >= minOpacity) {
      scratch.data.fill(0);
      fillStrokes(scratch, polylines, shape.strokeWidth * scale);
      const index = indexOf(shape.stroke);
      for (let i = 0; i < scratch.data.length; i++) if (scratch.data[i]) owner[i] = index;
    }
  }

  const layers: ArtworkLayer[] = colours.map((colour, index) => {
    const mask = emptyMask(grid);
    for (let i = 0; i < owner.length; i++) if (owner[i] === index) mask.data[i] = 1;
    return { colour, mask, areaMm2: maskAreaMm2(mask), role: 'stones' as LayerRole };
  });

  // Background: white, or one colour that covers (nearly) the whole artwork.
  if (ignoreBackground && layers.length > 1) {
    for (const layer of layers) {
      if (isWhite(layer.colour)) {
        layer.role = 'ignore';
        layer.reason = 'White is treated as the background.';
      } else if (layer.colour === firstShapeCoversAll) {
        layer.role = 'ignore';
        layer.reason = 'This colour covers the whole artwork, so it is treated as the background.';
      }
    }
    if (layers.every((layer) => layer.role === 'ignore')) layers.forEach((layer) => { layer.role = 'stones'; layer.reason = undefined; });
    for (const layer of layers) if (layer.role === 'ignore') warnings.push(`${layer.colour}: ${layer.reason}`);
  }

  const placedShapes: PlacedShape[] = placed.map(({ shape, polylines }) => ({
    polylines,
    fill: shape.fill,
    fillOpacity: shape.fillOpacity * shape.opacity,
    fillRule: shape.fillRule,
    stroke: shape.stroke,
    strokeWidthMm: shape.strokeWidth * scale,
    strokeOpacity: shape.strokeOpacity * shape.opacity,
  }));
  return { layers, grid, scale, polylines: placed.flatMap((p) => p.polylines), placedShapes, warnings };
}

export { boundsOfPolylines };
