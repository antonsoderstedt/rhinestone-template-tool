'use client';

/**
 * Garment preview for HTV designs — reuses the same flat-vector garment
 * silhouettes as the rhinestone tool's preview (GarmentSilhouette.tsx) but
 * overlays real HTV layer shapes at the chosen placement zone instead of
 * rhinestone circles in a fixed print area.
 */

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Shirt } from 'lucide-react';
import GarmentSilhouette from '../components/garmentPreview/GarmentSilhouette';
import { getGarmentColor } from '../components/garmentPreview/garmentCatalog';
import { getPlacementZoneBox } from './htvPlacementZones';
import { computeDesignBounds } from './htvGeometry';
import HtvLayerShape from './HtvLayerShape';
import type { HtvState } from './HtvState';

interface HtvGarmentPreviewPanelProps {
  open: boolean;
  state: HtvState;
  onClose: () => void;
}

const FIT_MARGIN = 0.92;

export default function HtvGarmentPreviewPanel({ open, state, onClose }: HtvGarmentPreviewPanelProps) {
  const { garment, layers } = state;
  const color = getGarmentColor(garment.colorId);
  const zoneBox = getPlacementZoneBox(garment.type, garment.placementZone);

  const overlayTransform = useMemo(() => {
    const bounds = computeDesignBounds(layers);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    const scale = Math.min((zoneBox.width * FIT_MARGIN) / bounds.width, (zoneBox.height * FIT_MARGIN) / bounds.height);
    const designCenterX = (bounds.minX + bounds.maxX) / 2;
    const designCenterY = (bounds.minY + bounds.maxY) / 2;
    const zoneCenterX = zoneBox.x + zoneBox.width / 2;
    const zoneCenterY = zoneBox.y + zoneBox.height / 2;
    return { scale, designCenterX, designCenterY, zoneCenterX, zoneCenterY };
  }, [layers, zoneBox]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="flex h-full max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-ink">
            <Shirt className="h-4 w-4 text-accent-600" />
            <div>
              <h2 className="text-sm font-semibold">Garment preview</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {garment.type === 'tshirt' ? 'T-shirt' : 'Hoodie'} · {garment.size} · {color.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close garment preview" className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-raised hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center p-6">
          <div className="h-full max-h-full w-full max-w-sm">
            <GarmentSilhouette garmentId={garment.type} color={color} size={garment.size} showPrintAreaGuide={!overlayTransform}>
              {overlayTransform &&
                layers.filter((l) => l.visible).map((layer) => (
                  <g
                    key={layer.id}
                    transform={`translate(${overlayTransform.zoneCenterX} ${overlayTransform.zoneCenterY}) scale(${overlayTransform.scale}) translate(${-overlayTransform.designCenterX} ${-overlayTransform.designCenterY}) translate(${layer.x} ${layer.y}) rotate(${layer.rotationDeg}) scale(${layer.scale})`}
                  >
                    <HtvLayerShape layer={layer} />
                  </g>
                ))}
            </GarmentSilhouette>
          </div>
        </div>

        {layers.length === 0 && (
          <div className="mx-5 mb-5 rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
            Nothing to preview yet — add a text or shape layer first.
          </div>
        )}
      </div>
    </div>
  );
}
