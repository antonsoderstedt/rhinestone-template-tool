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
import Modal from '../editor/ui/Modal';
import {
  GARMENTS,
  GARMENT_COLORS,
  GARMENT_SIZES,
  getGarmentColor,
  type GarmentSize,
  type GarmentType,
} from './garmentPreview/garmentCatalog';
import HtvMockupImage from '../htv/HtvMockupImage';
import { getHtvMockupView } from '../htv/htvMockupRegistry';
import { getPlacementZoneSizeMm } from '../htv/htvPlacementZones';

import { useT } from '../lib/i18n';
interface GarmentPreviewPanelProps {
  open: boolean;
  template: RhinestoneTemplate | null;
  onClose: () => void;
}

const DESIGN_FIT_MARGIN = 0.9;
/** The photos are laid out on a square of this many pixels (see htvMockupRegistry). */
const MOCKUP_SIZE = 640;

export default function GarmentPreviewPanel({ open, template, onClose }: GarmentPreviewPanelProps) {
  const t = useT();
  const [garmentId, setGarmentId] = useState<GarmentType>('tshirt');
  const [colorId, setColorId] = useState<string>('black');
  const [size, setSize] = useState<GarmentSize>('M');
  const [placement, setPlacement] = useState<'full-front' | 'left-chest'>('full-front');

  const color = getGarmentColor(colorId);

  // The photo, and where the design goes on it: the placement's rectangle in the photo's own pixels.
  const mockup = getHtvMockupView(garmentId, 'front');
  const placementRect = mockup.placements[placement] ?? mockup.placements['full-front']!;
  const zoneMm = getPlacementZoneSizeMm(garmentId, placement);
  const pxPerMm = Math.min(placementRect.width / zoneMm.widthMm, placementRect.height / zoneMm.heightMm);

  const overlay = useMemo(() => {
    if (!template || template.stones.length === 0) return null;
    const bounds = getTemplateStoneBounds(template);
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    // True size (so a 100 mm design looks 100 mm on the garment), but never bigger than the placement area.
    const fit = Math.min((placementRect.width * DESIGN_FIT_MARGIN) / bounds.width, (placementRect.height * DESIGN_FIT_MARGIN) / bounds.height);
    const scale = Math.min(pxPerMm, fit);
    return {
      scale,
      scaledToFit: scale < pxPerMm - 1e-9,
      designCenterX: (bounds.minX + bounds.maxX) / 2,
      designCenterY: (bounds.minY + bounds.maxY) / 2,
      centreX: placementRect.x + placementRect.width / 2,
      centreY: placementRect.y + placementRect.height / 2,
    };
  }, [template, placementRect, pxPerMm]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} titleId="garment-preview-title" overlayClassName="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-ink">
            <Shirt className="h-4 w-4 text-accent-600" />
            <div>
              <h2 id="garment-preview-title" className="text-sm font-semibold">{t('Garment preview')}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t('Shows where your design sits on a garment and roughly how big it is. Sizes are approximate — measure the real garment before cutting.')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('Close garment preview')}
            className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:flex-row md:overflow-hidden">
          <div className="flex w-full flex-col gap-4 md:w-64 md:shrink-0 md:overflow-y-auto">
            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">{t('Garment')}</span>
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

            <div className="space-y-2" role="group" aria-label={t('Placement')}>
              <span className="text-xs font-medium text-ink-secondary">{t('Placement')}</span>
              <div className="grid grid-cols-2 gap-2">
                {(['full-front', 'left-chest'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={placement === choice}
                    onClick={() => setPlacement(choice)}
                    className={`rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${placement === choice ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-raised text-ink-secondary hover:border-border-strong'}`}
                  >
                    {choice === 'full-front' ? t('Full front') : t('Left chest')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">{t('Color')}</span>
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
              <p className="text-xs text-ink-muted">{color.name}</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">{t('Size')}</span>
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
              <p className="text-xs text-ink-muted">
                {t('Print area')}: {zoneMm.widthMm} × {zoneMm.heightMm} mm
              </p>
              {overlay?.scaledToFit && <p className="text-xs text-warning-600">{t('The design is bigger than this area, so it is shown smaller than it is.')}</p>}
            </div>

            {!overlay && (
              <div className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
                {t('Nothing to preview yet — add stones to your design first.')}
              </div>
            )}
          </div>

          <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl bg-surface-raised p-6">
            <div className="relative aspect-square h-full max-h-full w-full max-w-md" data-testid="garment-photo-preview">
              <HtvMockupImage imageSrc={mockup.imageSrc} alt={t('Garment')} color={color} />
              <svg viewBox={`0 0 ${MOCKUP_SIZE} ${MOCKUP_SIZE}`} className="absolute inset-0 h-full w-full" role="img" aria-label={t('Your design on the garment')}>
                <defs>
                  <radialGradient id="preview-stone" cx="0.35" cy="0.3" r="0.8">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="0.5" stopColor="#dfe3f2" />
                    <stop offset="1" stopColor="#8c93ad" />
                  </radialGradient>
                </defs>
                {!overlay && <rect x={placementRect.x} y={placementRect.y} width={placementRect.width} height={placementRect.height} fill="none" stroke="rgba(124,77,255,0.7)" strokeDasharray="6 5" strokeWidth={1.5} />}
                {overlay && template && (
                  <g transform={`translate(${overlay.centreX} ${overlay.centreY}) scale(${overlay.scale}) translate(${-overlay.designCenterX} ${-overlay.designCenterY})`}>
                    {template.stones.map((stone) => (
                      <circle key={stone.id} cx={stone.center.x} cy={stone.center.y} r={stone.holeDiameterMm / 2} fill="url(#preview-stone)" stroke="rgba(255,255,255,0.45)" strokeWidth={0.25} />
                    ))}
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
