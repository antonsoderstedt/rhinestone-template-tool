'use client';

import { useMemo } from 'react';
import { thumbnailPolygons, type ThumbPolygon } from './papercraftThumbnail';
import type { BuiltInModel } from './papercraftModels';

const cache = new Map<string, ThumbPolygon[]>();

function pictureOf(model: BuiltInModel, index: number): ThumbPolygon[] {
  const cached = cache.get(model.id);
  if (cached) return cached;
  const out = thumbnailPolygons(model.mesh(), index, model.group === 'animals' ? 25 : 35, model.id === 'heart-box' || model.id === 'star-box' ? 50 : 24);
  cache.set(model.id, out);
  return out;
}

/** A small picture of a built-in model, drawn from the model itself (so it is always right, and there is no image to keep). */
export default function ModelThumb({ model, index }: { model: BuiltInModel; index: number }) {
  const polys = useMemo(() => pictureOf(model, index), [model, index]);
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12 shrink-0">
      {polys.map((p, i) => (
        <polygon key={i} points={p.points} fill={p.fill} stroke="#222" strokeWidth={0.5} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
