/**
 * SVG to polylines, for the generators that work on outlines.
 *
 * A thin layer over `importSvgArtwork` (see svgImport.ts), which does the reading: groups and transforms, `<use>`, CSS
 * classes, arcs, hidden elements. This keeps the long-standing API: every visible shape becomes polylines in the file's
 * user units (one unit is treated as one millimetre until the caller scales), then the polyline cleanup runs.
 *
 * The uploaded SVG is NEVER rendered or passed to dangerouslySetInnerHTML.
 */

import type { Polyline } from '../path/polyline';
import type { PolylineCleanupOptions } from '../path/polylineCleanup';
import { cleanupPolylines } from '../path/polylineCleanup';
import { importSvgArtwork } from './svgImport';

export interface SvgToPolylineOptions {
  /** Segments for circle approximation. Default: 64. */
  circleSegments?: number;
  /** Segments for ellipse approximation. Default: 64. */
  ellipseSegments?: number;
  /**
   * Segments per Bezier curve command (C/S/Q/T).
   * Higher values produce smoother curves. Default: 24.
   */
  curveSegments?: number;
  /**
   * Run the polyline cleanup pipeline after conversion.
   * Removes duplicate points, short segments, and tiny shapes.
   * Default: true.
   */
  cleanup?: boolean;
  /** Options passed to the cleanup pipeline. */
  cleanupOptions?: PolylineCleanupOptions;
}

/**
 * Converts an SVG string to Polylines for the rhinestone engine.
 *
 * @throws if the file contains unsafe content (scripts, external references, embedded images).
 * @throws if no visible shapes are found; the message says why (for example text that has not been converted to outlines).
 */
export function svgStringToPolylines(svgString: string, options: SvgToPolylineOptions = {}): Polyline[] {
  const imported = importSvgArtwork(svgString, {
    circleSegments: options.circleSegments ?? options.ellipseSegments,
    curveSegments: options.curveSegments,
  });

  const valid = imported.shapes.flatMap((shape) => shape.polylines).filter((polyline) => polyline.points.length >= 2);
  if (valid.length === 0) {
    const why = imported.warnings.find((warning) => warning.startsWith('Text was ignored'));
    throw new Error(
      'No supported SVG shapes found. ' +
        (why ?? 'The file has no visible lines or filled shapes (hidden shapes and shapes with neither fill nor stroke are skipped).'),
    );
  }

  if (options.cleanup !== false) {
    return cleanupPolylines(valid, options.cleanupOptions ?? {});
  }
  return valid;
}
