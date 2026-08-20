'use client';

import { useMemo, useRef } from 'react';
import { Palette, Shapes, Shirt, Sparkles, Type, Upload } from 'lucide-react';
import type { HtvAction, HtvState } from './HtvState';
import { GARMENTS, GARMENT_COLORS, GARMENT_SIZES, getGarmentColor, type GarmentSize, type GarmentType } from '../components/garmentPreview/garmentCatalog';
import { HTV_PLACEMENT_ZONES, type HtvPlacementZone } from './htvPlacementZones';
import { HTV_SHAPES, type HtvShapeId } from './htvShapeLibrary';
import { HTV_DESIGN_TEMPLATES, type HtvDesignTemplateId } from './htvDesignTemplates';
import { HTV_COLOR_PALETTES } from './htvColorPalettes';
import { getHtvColor, HTV_FINISHES } from './htvMaterialCatalog';
import ShapeThumbnail from './ShapeThumbnail';

interface HtvToolsPanelProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
  onAddText: () => void;
  onImportFile: (file: File) => void;
  onAddShape: (shapeId: HtvShapeId) => void;
  onAddTemplate: (templateId: HtvDesignTemplateId) => void;
  designSurface: 'canvas' | 'garment';
  onToggleDesignSurface: (surface: 'canvas' | 'garment') => void;
}

function PanelSection({ title, icon, children, defaultOpen = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-white/10 bg-[#202024] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          {icon}
          {title}
        </span>
        <span className="text-xs font-semibold text-zinc-500 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-white/10 px-3 py-3">{children}</div>
    </details>
  );
}

export default function HtvToolsPanel({ state, dispatch, onAddText, onImportFile, onAddShape, onAddTemplate, designSurface, onToggleDesignSurface }: HtvToolsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeGarmentColor = getGarmentColor(state.garment.colorId);
  const garmentColorsByFinish = useMemo(() => {
    return HTV_FINISHES.map((finish) => ({
      finish,
      colors: GARMENT_COLORS.filter((swatch) => {
        if (finish.id === 'metallic') return swatch.id === 'gold' || swatch.id === 'heather-gray';
        if (finish.id === 'glitter') return swatch.id === 'purple-glitter' || swatch.id === 'royal-blue';
        return finish.id === 'standard';
      }),
    }));
  }, []);

  return (
    <aside className="htv-dark-panel flex h-full w-full flex-col gap-3 overflow-y-auto border-r border-white/10 bg-[#252529] p-3 backdrop-blur-xl">
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
            className="flex flex-col items-start gap-2 rounded-lg border border-white/10 bg-[#17171a] px-3 py-3 text-left transition hover:border-white/20 hover:bg-[#1d1d22]"
          >
            <Type className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-medium text-zinc-100">Text</span>
            <span className="text-[11px] text-zinc-500">Real cut-ready letterforms</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-start gap-2 rounded-lg border border-white/10 bg-[#17171a] px-3 py-3 text-left transition hover:border-white/20 hover:bg-[#1d1d22]"
          >
            <Upload className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-medium text-zinc-100">Import</span>
            <span className="text-[11px] text-zinc-500">SVG, PNG, or JPEG</span>
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Shapes" icon={<Shapes className="h-4 w-4 text-zinc-500" />}>
        <div className="grid grid-cols-4 gap-2">
          {HTV_SHAPES.map((shape) => (
            <button
              key={shape.id}
              onClick={() => onAddShape(shape.id)}
              title={shape.displayName}
              aria-label={shape.displayName}
              className="flex aspect-square items-center justify-center rounded-lg border border-white/10 bg-[#17171a] p-2 text-zinc-300 transition hover:border-white/20 hover:bg-[#1d1d22] hover:text-zinc-100"
            >
              <ShapeThumbnail shapeId={shape.id} className="h-full w-full" />
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Design templates" icon={<Sparkles className="h-4 w-4 text-zinc-500" />}>
        <div className="grid gap-2">
          {HTV_DESIGN_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onAddTemplate(template.id)}
              className="rounded-lg border border-white/10 bg-[#17171a] px-3 py-2 text-left transition hover:border-white/20 hover:bg-[#1d1d22]"
            >
              <div className="text-sm font-medium text-zinc-100">{template.displayName}</div>
              <div className="mt-1 text-[11px] leading-5 text-zinc-500">{template.description}</div>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Color palettes" icon={<Palette className="h-4 w-4 text-zinc-500" />}>
        <p className="text-[11px] text-zinc-500">Applies across your layers in stack order.</p>
        <div className="space-y-2">
          {HTV_COLOR_PALETTES.map((palette) => (
            <button
              key={palette.id}
              disabled={state.layers.length === 0}
              onClick={() => dispatch({ type: 'APPLY_COLOR_PALETTE', colorIds: palette.colorIds })}
              className="overflow-hidden rounded-lg border border-white/10 bg-[#17171a] text-left transition hover:border-white/20 hover:bg-[#1d1d22] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center">
                <div className="min-w-0 flex-1 px-3 py-2">
                  <div className="text-sm font-medium text-zinc-100">{palette.displayName}</div>
                </div>
                <div className="flex h-10 w-32 overflow-hidden border-l border-white/10">
                  {palette.colorIds.map((colorId) => (
                    <span
                      key={colorId}
                      className="flex-1"
                      style={{ backgroundColor: getHtvColor(colorId).hex }}
                    />
                  ))}
                </div>
              </div>
            </button>
          ))}
          <button
            type="button"
            className="w-full rounded-lg border border-white/10 bg-[#232327] px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-[#2a2a30] hover:text-white"
          >
            More
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Garment & placement" icon={<Shirt className="h-4 w-4 text-zinc-500" />}>
        <div className="space-y-3 rounded-lg border border-white/10 bg-[#17171a] p-3">
          <div className="inline-flex rounded-md border border-white/10 bg-[#202024] p-1">
            {(['canvas', 'garment'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => onToggleDesignSurface(surface)}
                className={`rounded px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition ${designSurface === surface ? 'bg-violet-500/35 text-white' : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'}`}
              >
                {surface}
              </button>
            ))}
          </div>
          <div className="text-[11px] leading-5 text-zinc-500">
            {designSurface === 'garment' ? 'Design directly on the garment preview with placement context.' : 'Design on the neutral cut canvas for shape-first work.'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {GARMENTS.map((garment) => (
            <button
              key={garment.id}
              onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { type: garment.id as GarmentType } })}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${state.garment.type === garment.id ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-white/10 bg-[#17171a] text-zinc-400 hover:bg-[#1d1d22] hover:text-zinc-100'}`}
            >
              {garment.displayName}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Garment color</span>
            <span className="text-[11px] text-zinc-500">{activeGarmentColor.name}</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {GARMENT_COLORS.map((swatch) => (
              <button
                key={swatch.id}
                title={swatch.name}
                aria-label={swatch.name}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { colorId: swatch.id } })}
                className={`aspect-square rounded-md border-2 transition ${state.garment.colorId === swatch.id ? 'border-white shadow-[0_0_0_1px_rgba(139,92,246,0.9)]' : 'border-white/10'}`}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded-lg border border-white/10 bg-[#232327] px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-[#2a2a30] hover:text-white"
          >
            Import
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Size</span>
          <div className="grid grid-cols-5 gap-1">
            {GARMENT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { size: size as GarmentSize } })}
                className={`rounded-lg border px-1 py-1.5 text-xs font-medium transition ${state.garment.size === size ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-white/10 bg-[#17171a] text-zinc-400 hover:bg-[#1d1d22] hover:text-zinc-100'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Placement</span>
          <div className="space-y-1">
            {HTV_PLACEMENT_ZONES.map((zone) => (
              <button
                key={zone.id}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: zone.id as HtvPlacementZone } })}
                className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${state.garment.placementZone === zone.id ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-white/10 bg-[#17171a] text-zinc-400 hover:bg-[#1d1d22] hover:text-zinc-100'}`}
              >
                <div className="font-medium">{zone.displayName}</div>
                <div className="text-[10px] text-zinc-500">{zone.description}</div>
              </button>
            ))}
          </div>
        </div>
      </PanelSection>
    </aside>
  );
}
