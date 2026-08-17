'use client';

import { useEffect, useState } from 'react';
import { layoutTextToOpenTypePolylines, loadOutlineFont, type Polyline } from '@/src/lib/rhinestone-engine/index';
import { applyArcCurve, centerPolylines } from './htvGeometry';
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
      if (!layer.fontId || !layer.text.trim()) {
        if (!cancelled) setPolylines([]);
        return;
      }
      const loaded = await loadOutlineFont(layer.fontId);
      if (cancelled || !loaded.font) return;
      const raw = layoutTextToOpenTypePolylines({
        text: layer.text,
        font: loaded.font,
        fontSizeMm: layer.fontSizeMm,
        align: layer.align,
        letterSpacingMm: layer.letterSpacingMm,
      });
      if (cancelled) return;
      const centered = centerPolylines(raw).polylines;
      const curved = applyArcCurve(centered, layer.curveAmount);
      setPolylines(centerPolylines(curved).polylines);
    })();

    return () => {
      cancelled = true;
    };
  }, [layer.fontId, layer.text, layer.fontSizeMm, layer.align, layer.letterSpacingMm, layer.curveAmount]);

  return polylines;
}
