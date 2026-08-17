'use client';

import { useMemo } from 'react';
import { createShapePolylines, type HtvShapeId } from './htvShapeLibrary';
import { computePolylinesBounds, polylinesToPathD } from './htvGeometry';

/** Small filled-shape icon, used in the shapes grid and layer thumbnails. */
export default function ShapeThumbnail({ shapeId, className }: { shapeId: HtvShapeId; className?: string }) {
  const { d, viewBox } = useMemo(() => {
    const { polylines } = createShapePolylines(shapeId);
    const bounds = computePolylinesBounds(polylines);
    const pad = Math.max(bounds.width, bounds.height) * 0.08 + 0.5;
    return {
      d: polylinesToPathD(polylines),
      viewBox: `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`,
    };
  }, [shapeId]);

  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true">
      <path d={d} fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}
