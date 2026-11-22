'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArtworkLook } from '@/src/lib/rhinestone-engine/index';
import type { SvgToolState } from './EditorState';
import { generateLookThumbnails } from './artworkGeneration';
import type { TextThumbnail } from './textStyleThumbnails';

/**
 * The artwork in each look, as small pictures for the Look control. Made a moment after the settings stop changing, so
 * typing a size does not wait for three extra layouts. `undefined` until they are ready, and for a picture file.
 */
export function useLookThumbnails(svgTool: SvgToolState): Partial<Record<ArtworkLook, TextThumbnail>> | undefined {
  const enabled = svgTool.assetKind !== 'image' && Boolean(svgTool.uploadedSvgText);
  const key = JSON.stringify([
    svgTool.uploadedSvgText?.length,
    svgTool.uploadedSvgText?.slice(0, 120),
    svgTool.stoneSize,
    svgTool.targetWidthMm,
    svgTool.targetHeightMm,
    svgTool.preserveAspectRatio,
    svgTool.densityPreset,
    svgTool.customSpacingMm,
    svgTool.layerRoles,
    svgTool.layerStoneColours,
    svgTool.contourSettings.rowCount,
  ]);
  const latest = useRef(svgTool);
  useEffect(() => {
    latest.current = svgTool;
  });
  const [result, setResult] = useState<{ key: string; pictures: Partial<Record<ArtworkLook, TextThumbnail>> } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      try {
        setResult({ key, pictures: generateLookThumbnails(latest.current) });
      } catch {
        setResult({ key, pictures: {} });
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [enabled, key]);

  return enabled && result && result.key === key ? result.pictures : undefined;
}
