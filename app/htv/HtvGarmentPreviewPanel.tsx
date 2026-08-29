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
import { getGarmentColor, getGarmentDefinition } from '../components/garmentPreview/garmentCatalog';
import { getPlacementViewForZone, getPlacementZoneBox } from './htvPlacementZones';
import { computeDesignBounds } from './htvGeometry';
import HtvLayerShape from './HtvLayerShape';
import HtvMockupImage from './HtvMockupImage';
import type { HtvState } from './HtvState';
import { getHtvMockupView, HTV_MOCKUP_IMAGE_SIZE } from './htvMockupRegistry';

interface HtvGarmentPreviewPanelProps {
  open: boolean;
  state: HtvState;
  showAllPlacementOverlays: boolean;
  onClose: () => void;
}

const FIT_MARGIN = 0.92;

export default function HtvGarmentPreviewPanel({ open, state, showAllPlacementOverlays, onClose }: HtvGarmentPreviewPanelProps) {
  const { garment, layers } = state;
  const color = getGarmentColor(garment.colorId);
  const garmentDefinition = getGarmentDefinition(garment.type);
  const sceneBackground = color.shade === 'dark'
    ? 'radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 38%), linear-gradient(180deg, #4a4d57, #2a2c33 52%, #1f2026)'
    : 'radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 35%), linear-gradient(180deg, #2a2b31, #1b1c21)';
  const view = getPlacementViewForZone(garment.placementZone);
  const mockupView = getHtvMockupView(garment.type, view);
  const placementOverlays = useMemo(() => {
    return garment.activePlacementZones
      .filter((zone) => showAllPlacementOverlays || zone === garment.placementZone)
      .filter((zone) => getPlacementViewForZone(zone) === view)
      .map((zone) => {
        const zoneBox = mockupView.placements[zone] ?? getPlacementZoneBox(garment.type, zone);
        const placementLayers = layers.filter((layer) => layer.placementId === zone && layer.visible);
        const bounds = computeDesignBounds(placementLayers);
        const transform = bounds && bounds.width > 0 && bounds.height > 0
          ? (() => {
              const scale = Math.min((zoneBox.width * FIT_MARGIN) / bounds.width, (zoneBox.height * FIT_MARGIN) / bounds.height);
              const designCenterX = (bounds.minX + bounds.maxX) / 2;
              const designCenterY = (bounds.minY + bounds.maxY) / 2;
              const zoneCenterX = zoneBox.x + zoneBox.width / 2;
              const zoneCenterY = zoneBox.y + zoneBox.height / 2;
              return { scale, designCenterX, designCenterY, zoneCenterX, zoneCenterY };
            })()
          : null;
        return { zone, zoneBox, placementLayers, transform };
      });
  }, [garment.activePlacementZones, garment.placementZone, garment.type, layers, mockupView.placements, showAllPlacementOverlays, view]);

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
                {garmentDefinition.displayName} · {garment.size} · {color.name} · {view}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close garment preview" className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-raised hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center p-6">
          <div className="relative h-full max-h-full w-full max-w-sm overflow-hidden rounded-md border border-white/10" style={{ backgroundImage: sceneBackground }}>
            <HtvMockupImage imageSrc={mockupView.imageSrc} alt={`${garment.type} ${view} preview`} color={color} />
            <svg viewBox={`0 0 ${HTV_MOCKUP_IMAGE_SIZE} ${HTV_MOCKUP_IMAGE_SIZE}`} className="absolute inset-0 h-full w-full">
              {placementOverlays.map((placement) => (
                <g key={placement.zone}>
                  <rect
                    x={placement.zoneBox.x}
                    y={placement.zoneBox.y}
                    width={placement.zoneBox.width}
                    height={placement.zoneBox.height}
                    fill="none"
                    stroke={placement.zone === garment.placementZone ? 'rgba(236,72,153,0.95)' : 'rgba(236,72,153,0.5)'}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    rx="4"
                  />
                  {(() => {
                    const transform = placement.transform;
                    if (!transform) return null;
                    return placement.placementLayers.map((layer) => (
                      <g
                        key={layer.id}
                        opacity={placement.zone === garment.placementZone ? 1 : 0.35}
                        transform={`translate(${transform.zoneCenterX} ${transform.zoneCenterY}) scale(${transform.scale}) translate(${-transform.designCenterX} ${-transform.designCenterY}) translate(${layer.x} ${layer.y}) rotate(${layer.rotationDeg}) scale(${layer.scale})`}
                      >
                        <HtvLayerShape layer={layer} />
                      </g>
                    ));
                  })()}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {placementOverlays.every((placement) => placement.placementLayers.length === 0) && (
          <div className="mx-5 mb-5 rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
            Nothing to preview yet — add a text or shape layer first.
          </div>
        )}
      </div>
    </div>
  );
}
