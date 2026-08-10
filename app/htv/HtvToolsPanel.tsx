'use client';

import { useRef } from 'react';
import { Layers, Shirt, Type, Upload } from 'lucide-react';
import type { HtvAction, HtvState } from './HtvState';
import { GARMENTS, GARMENT_COLORS, GARMENT_SIZES, getGarmentColor, type GarmentSize, type GarmentType } from '../components/garmentPreview/garmentCatalog';
import { HTV_PLACEMENT_ZONES, type HtvPlacementZone } from './htvPlacementZones';

interface HtvToolsPanelProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
  onAddText: () => void;
  onImportFile: (file: File) => void;
}

export default function HtvToolsPanel({ state, dispatch, onAddText, onImportFile }: HtvToolsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto border-r border-border bg-surface-raised/90 p-4">
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

      <section className="space-y-3 rounded-2xl border border-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-ink">Add to design</h3>
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
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-surface-raised p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-ink-muted" />
          <h3 className="text-sm font-semibold text-ink">Asset library</h3>
        </div>
        <p className="text-xs text-ink-muted">
          No assets yet — this library ships empty. Import your own SVGs above, or add clipart here once you have a set to bring in.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface-raised p-4">
        <div className="flex items-center gap-2">
          <Shirt className="h-4 w-4 text-ink-muted" />
          <h3 className="text-sm font-semibold text-ink">Garment &amp; placement</h3>
        </div>

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
      </section>
    </aside>
  );
}
