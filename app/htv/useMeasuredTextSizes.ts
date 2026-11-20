'use client';

import { useEffect, useMemo, useState } from 'react';
import { measureHtvTextLayer, textLayoutKey } from './htvTextLayout';
import type { HtvLayer } from './HtvState';

type MeasuredSizes = ReadonlyMap<string, { width: number; height: number }>;

/**
 * Real sizes of the text layers' outlines, by layer id. Text outlines load
 * asynchronously, so an entry appears shortly after a layer is added or its
 * text/font/size changes; layers still being measured are simply absent.
 */
export function useMeasuredTextSizes(layers: readonly HtvLayer[]): MeasuredSizes {
  const textLayers = useMemo(
    () => layers.flatMap((layer) => (layer.type === 'text' ? [{ layer, key: textLayoutKey(layer) }] : [])),
    [layers],
  );
  const [measured, setMeasured] = useState<ReadonlyMap<string, { key: string; width: number; height: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const { layer, key } of textLayers) {
        if (cancelled) return;
        if (measured.get(layer.id)?.key === key) continue;
        const size = await measureHtvTextLayer(layer);
        if (cancelled || !size) continue;
        setMeasured((current) => new Map(current).set(layer.id, { key, ...size }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // `measured` is read only to skip layers that are already up to date; re-running on its change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textLayers]);

  return useMemo(() => {
    const current = new Map<string, { width: number; height: number }>();
    for (const { layer, key } of textLayers) {
      const entry = measured.get(layer.id);
      if (entry && entry.key === key) current.set(layer.id, { width: entry.width, height: entry.height });
    }
    return current;
  }, [textLayers, measured]);
}
