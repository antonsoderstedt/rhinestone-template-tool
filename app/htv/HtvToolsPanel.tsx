'use client';

import { useRef } from 'react';
import { Palette, Shapes, Shirt, Sparkles, Type, Upload } from 'lucide-react';
import type { HtvAction, HtvState } from './HtvState';
import { GARMENTS, GARMENT_COLORS, GARMENT_SIZES, getGarmentColor, type GarmentSize, type GarmentType } from '../components/garmentPreview/garmentCatalog';
import { HTV_PLACEMENT_ZONES, type HtvPlacementZone } from './htvPlacementZones';
import { HTV_SHAPES, type HtvShapeId } from './htvShapeLibrary';
import { HTV_DESIGN_TEMPLATES, type HtvDesignTemplateId } from './htvDesignTemplates';
import { HTV_COLOR_PALETTES } from './htvColorPalettes';
import { getHtvColor } from './htvMaterialCatalog';
import ShapeThumbnail from './ShapeThumbnail';

interface HtvToolsPanelProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
  onAddText: () => void;
  onImportFile: (file: File) => void;
  onAddShape: (shapeId: HtvShapeId) => void;
  onAddTemplate: (templateId: HtvDesignTemplateId) => void;
}

function PanelSection({ title, icon, children, defaultOpen = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-[1.1rem] border border-border/80 bg-[rgba(255,255,255,0.88)] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon}
          {title}
        </span>
        <span className="text-xs font-semibold text-ink-muted transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-border/60 px-3 py-3">{children}</div>
    </details>
  );
}

export default function HtvToolsPanel({ state, dispatch, onAddText, onImportFile, onAddShape, onAddTemplate }: HtvToolsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="flex h-full w-full flex-col gap-3 overflow-y-auto border-r border-border/80 bg-[rgba(244,239,232,0.76)] p-3 backdrop-blur-xl">
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportFile(file);
          e.target.value = '';
        }}
      />

      <PanelSection title="Add to design">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAddText}
            className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-sunken px-3 py-3 text-left transition hover:border-border-strong hover:bg-surface-raised"
          >
            <Type className="h-4 w-4 text-accent-600" />
            <span className="text-sm font-medium text-ink">Text</span>
            <span className="text-[11px] text-ink-muted">Real cut-ready letterforms</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-sunken px-3 py-3 text-left transition hover:border-border-strong hover:bg-surface-raised"
          >
            <Upload className="h-4 w-4 text-accent-600" />
            <span className="text-sm font-medium text-ink">Import</span>
            <span className="text-[11px] text-ink-muted">SVG, PNG, or JPEG</span>
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Shapes" icon={<Shapes className="h-4 w-4 text-ink-muted" />}>
        <div className="grid grid-cols-4 gap-2">
          {HTV_SHAPES.map((shape) => (
            <button
              key={shape.id}
              onClick={() => onAddShape(shape.id)}
              title={shape.displayName}
              aria-label={shape.displayName}
              className="flex aspect-square items-center justify-center rounded-lg border border-border bg-surface-sunken p-2 text-ink-secondary transition hover:border-border-strong hover:bg-surface-raised hover:text-ink"
            >
              <ShapeThumbnail shapeId={shape.id} className="h-full w-full" />
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Design templates" icon={<Sparkles className="h-4 w-4 text-ink-muted" />} defaultOpen={false}>
        <div className="space-y-1.5">
          {HTV_DESIGN_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onAddTemplate(template.id)}
              className="w-full rounded-lg border border-border bg-surface-sunken px-2.5 py-2 text-left text-xs transition hover:border-border-strong hover:bg-surface-raised"
            >
              <div className="font-medium text-ink">{template.displayName}</div>
              <div className="text-[10px] text-ink-muted">{template.description}</div>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Color palettes" icon={<Palette className="h-4 w-4 text-ink-muted" />} defaultOpen={false}>
        <p className="text-[11px] text-ink-muted">Applies across your layers in stack order.</p>
        <div className="space-y-1.5">
          {HTV_COLOR_PALETTES.map((palette) => (
            <button
              key={palette.id}
              disabled={state.layers.length === 0}
              onClick={() => dispatch({ type: 'APPLY_COLOR_PALETTE', colorIds: palette.colorIds })}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-sunken px-2.5 py-2 text-left text-xs transition hover:border-border-strong hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="flex shrink-0 -space-x-1">
                {palette.colorIds.map((colorId, i) => (
                  <span
                    key={i}
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundColor: getHtvColor(colorId).hex }}
                  />
                ))}
              </span>
              <span className="font-medium text-ink">{palette.displayName}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Garment & placement" icon={<Shirt className="h-4 w-4 text-ink-muted" />} defaultOpen={false}>

        <div className="grid grid-cols-2 gap-2">
          {GARMENTS.map((garment) => (
            <button
              key={garment.id}
              onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { type: garment.id as GarmentType } })}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${state.garment.type === garment.id ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary'}`}
            >
              {garment.displayName}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-ink-secondary">Garment color</span>
          <div className="grid grid-cols-8 gap-1">
            {GARMENT_COLORS.map((swatch) => (
              <button
                key={swatch.id}
                title={swatch.name}
                aria-label={swatch.name}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { colorId: swatch.id } })}
                className={`aspect-square rounded-full border-2 ${state.garment.colorId === swatch.id ? 'border-accent-500' : 'border-border'}`}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </div>
          <p className="text-[11px] text-ink-muted">{getGarmentColor(state.garment.colorId).name}</p>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-ink-secondary">Size</span>
          <div className="grid grid-cols-5 gap-1">
            {GARMENT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { size: size as GarmentSize } })}
                className={`rounded-lg border px-1 py-1.5 text-xs font-medium transition ${state.garment.size === size ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-ink-secondary">Placement</span>
          <div className="space-y-1">
            {HTV_PLACEMENT_ZONES.map((zone) => (
              <button
                key={zone.id}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: zone.id as HtvPlacementZone } })}
                className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${state.garment.placementZone === zone.id ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary'}`}
              >
                <div className="font-medium">{zone.displayName}</div>
                <div className="text-[10px] text-ink-muted">{zone.description}</div>
              </button>
            ))}
          </div>
        </div>
      </PanelSection>
    </aside>
  );
}
