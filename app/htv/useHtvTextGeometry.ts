'use client';

import { useEffect, useState } from 'react';
import type { Polyline } from '@/src/lib/rhinestone-engine/index';
import { layoutHtvTextLayer } from './htvTextLayout';
import type { HtvTextLayer } from './HtvState';

/**
 * Live vector geometry for a text layer — loads the bundled OpenType font
 * (cached by loadOutlineFont) and lays out real filled letterform outlines,
 * centered so the layer's x/y state means "where this text's center sits."
 * Recomputes whenever the text/font/size/spacing changes, for live preview.
 */
export function useHtvTextGeometry(layer: HtvTextLayer): Polyline[] | null {
  const [polylines, setPolylines] = useState<Polyline[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const laidOut = await layoutHtvTextLayer(layer);
      if (!cancelled && laidOut) setPolylines(laidOut);
    })();

    return () => {
      cancelled = true;
    };
    // The layout depends only on these fields; depending on `layer` itself would redo it on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.fontId, layer.text, layer.fontSizeMm, layer.align, layer.letterSpacingMm, layer.curveAmount]);

  return polylines;
}
