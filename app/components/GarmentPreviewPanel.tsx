'use client';

/**
 * Garment mockup preview — v1 flat vector illustrations (see chat decision
 * log: real mockup photography will replace these once provided). Shows
 * the current design scaled into a garment's front print area across
 * garment type, color, and size.
 */

import { useMemo, useState } from 'react';
import { Shirt, X } from 'lucide-react';
import { getTemplateStoneBounds, type RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';
import {
  GARMENTS,
  GARMENT_COLORS,
  GARMENT_SIZES,
  getPrintAreaMm,
  getGarmentColor,
  type GarmentSize,
  type GarmentType,
} from './garmentPreview/garmentCatalog';
import GarmentSilhouette, { getPrintAreaBox } from './garmentPreview/GarmentSilhouette';

interface GarmentPreviewPanelProps {
  open: boolean;
  template: RhinestoneTemplate | null;
  onClose: () => void;
}

const DESIGN_FIT_MARGIN = 0.9;

export default function GarmentPreviewPanel({ open, template, onClose }: GarmentPreviewPanelProps) {
  const [garmentId, setGarmentId] = useState<GarmentType>('tshirt');
  const [colorId, setColorId] = useState<string>('black');
  const [size, setSize] = useState<GarmentSize>('M');

  const color = getGarmentColor(colorId);
  const printAreaMm = getPrintAreaMm(garmentId, size);
  const printAreaBox = getPrintAreaBox(garmentId, size);

  const overlay = useMemo(() => {
    if (!template || template.stones.length === 0) return null;
    const bounds = getTemplateStoneBounds(template);
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const scale = Math.min(
      (printAreaBox.width * DESIGN_FIT_MARGIN) / bounds.width,
      (printAreaBox.height * DESIGN_FIT_MARGIN) / bounds.height,
    );
    const designCenterX = (bounds.minX + bounds.maxX) / 2;
    const designCenterY = (bounds.minY + bounds.maxY) / 2;
    const printAreaCenterX = printAreaBox.x + printAreaBox.width / 2;
    const printAreaCenterY = printAreaBox.y + printAreaBox.height / 2;

    return { scale, designCenterX, designCenterY, printAreaCenterX, printAreaCenterY };
  }, [template, printAreaBox]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="flex h-full max-h-[720px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-ink">
            <Shirt className="h-4 w-4 text-accent-600" />
            <div>
              <h2 className="text-sm font-semibold">Garment preview</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Flat mockup — swap in real product photos once you have them.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close garment preview"
            className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:flex-row md:overflow-hidden">
          <div className="flex w-full flex-col gap-4 md:w-64 md:shrink-0 md:overflow-y-auto">
            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">Garment</span>
              <div className="grid grid-cols-2 gap-2">
                {GARMENTS.map((garment) => (
                  <button
                    key={garment.id}
                    type="button"
                    onClick={() => setGarmentId(garment.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                      garmentId === garment.id
                        ? 'border-accent-400 bg-accent-50 text-ink'
                        : 'border-border bg-surface-raised text-ink-secondary hover:border-border-strong'
                    }`}
                  >
                    {garment.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">Color</span>
              <div className="grid grid-cols-4 gap-2">
                {GARMENT_COLORS.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => setColorId(swatch.id)}
                    aria-label={swatch.name}
                    title={swatch.name}
                    className={`aspect-square rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                      colorId === swatch.id ? 'border-accent-500' : 'border-border'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-ink-muted">{color.name}</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">Size</span>
              <div className="grid grid-cols-5 gap-1.5">
                {GARMENT_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`rounded-lg border px-1 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                      size === s
                        ? 'border-accent-400 bg-accent-50 text-ink'
                        : 'border-border bg-surface-raised text-ink-secondary hover:border-border-strong'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted">
                Print area: {printAreaMm.widthMm} × {printAreaMm.heightMm} mm
              </p>
            </div>

            {!overlay && (
              <div className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
                Nothing to preview yet — add stones to your design first.
              </div>
            )}
          </div>

          <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl bg-surface-raised p-6">
            <div className="h-full max-h-full w-full max-w-md">
              <GarmentSilhouette garmentId={garmentId} color={color} size={size} showPrintAreaGuide={!overlay}>
                {overlay && template && (
                  <g
                    transform={`translate(${overlay.printAreaCenterX} ${overlay.printAreaCenterY}) scale(${overlay.scale}) translate(${-overlay.designCenterX} ${-overlay.designCenterY})`}
                  >
                    {template.stones.map((stone) => (
                      <circle
                        key={stone.id}
                        cx={stone.center.x}
                        cy={stone.center.y}
                        r={stone.holeDiameterMm / 2}
                        fill="url(#rhinestone-sparkle)"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={0.3}
                      />
                    ))}
                  </g>
                )}
              </GarmentSilhouette>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
