'use client';

import { Shirt } from 'lucide-react';
import GarmentSilhouette from '../components/garmentPreview/GarmentSilhouette';
import { getGarmentColor } from '../components/garmentPreview/garmentCatalog';
import { getPlacementZoneBox } from './htvPlacementZones';
import { computeDesignBounds } from './htvGeometry';
import HtvLayerShape from './HtvLayerShape';
import type { HtvState } from './HtvState';

const FIT_MARGIN = 0.9;

export default function HtvGarmentStage({ state }: { state: HtvState }) {
  const { garment, layers } = state;
  const color = getGarmentColor(garment.colorId);
  const zoneBox = getPlacementZoneBox(garment.type, garment.placementZone);
  const bounds = computeDesignBounds(layers);

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

  return (
    <div className="relative flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#202024] p-4 lg:p-8">
      <div className="absolute left-4 top-4 z-10 max-w-[min(360px,calc(100%-2rem))] rounded-md border border-white/10 bg-[#17171a]/90 px-3 py-2 shadow-md backdrop-blur-sm">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Garment canvas</div>
        <div className="mt-1 text-xs text-zinc-400">
          {layers.length > 0 ? `${layers.length} layer${layers.length === 1 ? '' : 's'} on ${garment.type} · ${garment.placementZone}` : 'Add text, shapes, or imported artwork'}
        </div>
      </div>

      <div className="w-full max-w-[780px] rounded-lg border border-white/10 bg-[#17171a] p-4 shadow-2xl shadow-black/30 lg:p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Shirt className="h-4 w-4 text-violet-300" />
          <span>{garment.type === 'tshirt' ? 'T-shirt' : 'Hoodie'} · {garment.size} · {color.name}</span>
        </div>
        <div className="aspect-[5/6] w-full overflow-hidden rounded-md border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_35%),linear-gradient(180deg,#2a2b31,#1b1c21)]">
          <GarmentSilhouette garmentId={garment.type} color={color} size={garment.size} showPrintAreaGuide={!transform}>
            {transform && layers.filter((layer) => layer.visible).map((layer) => (
              <g
                key={layer.id}
                transform={`translate(${transform.zoneCenterX} ${transform.zoneCenterY}) scale(${transform.scale}) translate(${-transform.designCenterX} ${-transform.designCenterY}) translate(${layer.x} ${layer.y}) rotate(${layer.rotationDeg}) scale(${layer.scale})`}
              >
                <HtvLayerShape layer={layer} />
              </g>
            ))}
          </GarmentSilhouette>
        </div>
      </div>
    </div>
  );
}