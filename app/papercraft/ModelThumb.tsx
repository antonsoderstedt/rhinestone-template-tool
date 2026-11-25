'use client';

import { useMemo } from 'react';
import { buildSolid, partRgb, projectSolid, scaleMesh } from '@/src/lib/papercraft-engine';
import type { BuiltInModel } from './papercraftModels';

const cache = new Map<string, { points: string; fill: string }[]>();

/** A small picture of a built-in model, drawn from the model itself (so it is always right, and there is no image to keep). */
function pictureOf(model: BuiltInModel, index: number) {
  const cached = cache.get(model.id);
  if (cached) return cached;
  const solid = buildSolid(scaleMesh(model.mesh(), { by: 'largest', mm: 100 }));
  const colour = partRgb(index + 1, 70);
  const polys = projectSolid(solid, () => colour, model.group === 'animals' ? 25 : 35, model.id === 'heart-box' || model.id === 'star-box' ? 50 : 24);
  const all = polys.flatMap((p) => p.points);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const scale = 40 / Math.max(maxX - minX, maxY - minY, 1e-6);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const out = polys.map((p) => ({
    points: p.points.map((q) => `${(24 + (q[0] - cx) * scale).toFixed(2)},${(24 - (q[1] - cy) * scale).toFixed(2)}`).join(' '),
    fill: `rgb(${p.rgb.map((c) => Math.round(c * 255)).join(',')})`,
  }));
  cache.set(model.id, out);
  return out;
}

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
