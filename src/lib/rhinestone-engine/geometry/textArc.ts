/**
 * Arc/wave warp for text polylines ("curved text").
 *
 * Pure geometry transform: takes laid-out text polylines (mm space, as
 * produced by the outline-text or HTV text-layout pipelines) and bends them
 * along a circular arc. Used by both Rhinestone Studio's outline-text
 * generator and HTV Studio's text layers — kept here, not in either studio's
 * app code, so both can share one implementation.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';

export interface WarpPolylinesOnArcOptions {
  /**
   * Bend strength. 0 leaves the text straight (identity transform).
   * Positive values bow the text into a dome/rainbow (ends droop toward the
   * baseline, matching a common "arc up" badge style); negative values bow
   * it into a valley/smile (ends lift away from the baseline). Recommended
   * range is -1..1 — 1 wraps the text across a half circle — but values
   * outside that range are accepted and simply curl tighter.
   */
  curveAmount: number;
}

/** curveAmount = ±1 sweeps the text across this many radians (a half circle). */
const MAX_BEND_RADIANS = Math.PI;

function cloneStraight(polylines: readonly Polyline[]): Polyline[] {
  return polylines.map((polyline) => ({
    points: polyline.points.map((point) => ({ x: point.x, y: point.y })),
    closed: polyline.closed,
  }));
}

/**
 * Bends text polylines along a circular arc.
 *
 * The horizontal extent (bounding box x-range) of all input polylines
 * combined is treated as the baseline the arc is measured across; each
 * point's own y-offset from that baseline is preserved as a radial offset,
 * so stroke thickness survives the warp instead of collapsing onto a single
 * curve. For multi-line text the same treatment is applied per point using
 * one shared arc, which produces concentric stacked arcs across lines —
 * intentional, not a bug.
 *
 * @throws if curveAmount is not a finite number.
 */
export function warpPolylinesOnArc(
  polylines: readonly Polyline[],
  options: WarpPolylinesOnArcOptions,
): Polyline[] {
  const { curveAmount } = options;

  if (typeof curveAmount !== 'number' || !isFinite(curveAmount)) {
    throw new Error(`warpPolylinesOnArc: "curveAmount" must be a finite number, got ${curveAmount}.`);
  }

  if (curveAmount === 0 || polylines.length === 0) {
    return cloneStraight(polylines);
  }

  const allPoints = polylines.flatMap((polyline) => polyline.points);
  if (allPoints.length === 0) {
    return cloneStraight(polylines);
  }

  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const widthMm = maxX - minX;

  if (widthMm <= 0) {
    return cloneStraight(polylines);
  }

  const centerX = (minX + maxX) / 2;
  const totalAngleRadians = curveAmount * MAX_BEND_RADIANS;
  // Signed radius: positive for a dome (curveAmount > 0), negative for a
  // valley (curveAmount < 0). Carrying the sign through keeps the point
  // formula below identical for both directions instead of branching.
  const signedRadiusMm = widthMm / totalAngleRadians;

  const warpPoint = (point: PolylinePoint): PolylinePoint => {
    const t = (point.x - centerX) / widthMm; // -0.5..0.5 across the text
    const theta = t * totalAngleRadians;
    const effectiveRadius = signedRadiusMm - point.y;
    return {
      x: centerX + effectiveRadius * Math.sin(theta),
      y: signedRadiusMm - effectiveRadius * Math.cos(theta),
    };
  };

  return polylines.map((polyline) => ({
    points: polyline.points.map(warpPoint),
    closed: polyline.closed,
  }));
}
