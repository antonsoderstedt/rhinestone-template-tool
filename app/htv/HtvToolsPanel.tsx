'use client';

import Link from 'next/link';
import { useMemo, useRef } from 'react';
import { LibraryBig, Palette, Shapes, Shirt, Sparkles, Type, Upload } from 'lucide-react';
import type { HtvAction, HtvState } from './HtvState';
import { GARMENTS, GARMENT_COLORS, getGarmentColor, type GarmentSize, type GarmentType } from '../components/garmentPreview/garmentCatalog';
import { getPlacementsForGarmentType, type HtvPlacementZone } from './htvPlacementZones';
import { HTV_SHAPES, type HtvShapeId } from './htvShapeLibrary';
import { HTV_DESIGN_TEMPLATES, type HtvDesignTemplateId } from './htvDesignTemplates';
import { HTV_COLOR_PALETTES } from './htvColorPalettes';
import { getHtvColor } from './htvMaterialCatalog';
import ShapeThumbnail from './ShapeThumbnail';
import type { WorkspaceAsset } from '../lib/workspaceVault';

interface HtvToolsPanelProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
  libraryAssets: WorkspaceAsset[];
  onAddText: () => void;
  onImportFile: (file: File) => void;
  onAddShape: (shapeId: HtvShapeId) => void;
  onAddTemplate: (templateId: HtvDesignTemplateId) => void;
  onAddLibraryAsset: (assetId: string) => void;
  designSurface: 'canvas' | 'garment' | '3d';
  onToggleDesignSurface: (surface: 'canvas' | 'garment' | '3d') => void;
  placementOverlayMode: 'active-only' | 'all-active';
  onTogglePlacementOverlayMode: (mode: 'active-only' | 'all-active') => void;
}

function PanelSection({ title, icon, children, defaultOpen = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--studio-ink)]">
          {icon}
          {title}
        </span>
        <span className="text-xs font-semibold text-[var(--studio-ink-subtle)] transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-[var(--studio-border)] px-3 py-3">{children}</div>
    </details>
  );
}

export default function HtvToolsPanel({ state, dispatch, libraryAssets, onAddText, onImportFile, onAddShape, onAddTemplate, onAddLibraryAsset, designSurface, onToggleDesignSurface, placementOverlayMode, onTogglePlacementOverlayMode }: HtvToolsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeGarmentColor = getGarmentColor(state.garment.colorId);
  const placementDefinitions = useMemo(() => getPlacementsForGarmentType(state.garment.type), [state.garment.type]);
  const garmentDefinition = useMemo(() => GARMENTS.find((garment) => garment.id === state.garment.type) ?? GARMENTS[0]!, [state.garment.type]);
  const recentLibraryAssets = useMemo(() => libraryAssets.slice(0, 6), [libraryAssets]);

  const togglePlacement = (zone: HtvPlacementZone) => {
    const active = new Set(state.garment.activePlacementZones);
    if (active.has(zone)) {
      if (active.size === 1) {
        dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: zone } });
        return;
      }
      active.delete(zone);
      const nextSelected = state.garment.placementZone === zone ? [...active][0] ?? 'full-front' : state.garment.placementZone;
      dispatch({ type: 'UPDATE_GARMENT', updates: { activePlacementZones: [...active], placementZone: nextSelected } });
      return;
    }
    active.add(zone);
    dispatch({ type: 'UPDATE_GARMENT', updates: { activePlacementZones: [...active], placementZone: zone } });
  };

  return (
    <aside className="htv-studio-panel flex h-full w-full flex-col gap-3 overflow-y-auto border-r border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 backdrop-blur-xl">
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
            className="flex flex-col items-start gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-3 text-left transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]"
          >
            <Type className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-medium text-[var(--studio-ink)]">Text</span>
            <span className="text-[11px] text-[var(--studio-ink-subtle)]">Real cut-ready letterforms</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-start gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-3 text-left transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]"
          >
            <Upload className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-medium text-[var(--studio-ink)]">Import</span>
            <span className="text-[11px] text-[var(--studio-ink-subtle)]">SVG, PNG, or JPEG</span>
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Workspace library" icon={<LibraryBig className="h-4 w-4 text-[var(--studio-ink-subtle)]" />}>
        {recentLibraryAssets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-3 text-xs leading-6 text-[var(--studio-ink-subtle)]">
            No library assets yet. Upload assets in Library and they will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {recentLibraryAssets.map((asset) => (
              <button
                key={asset.assetId}
                type="button"
                onClick={() => onAddLibraryAsset(asset.assetId)}
                className="flex w-full items-center gap-3 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-2 text-left transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- asset previews come from local workspace data URLs */}
                  <img src={asset.previewDataUrl} alt="" aria-hidden="true" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--studio-ink)]">{asset.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--studio-ink-subtle)]">{asset.kind === 'svg' ? 'Vector' : 'Raster'} · add to {state.garment.placementZone}</div>
                </div>
              </button>
            ))}
            <Link
              href="/library"
              className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-2)] px-3 py-2 text-sm font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-surface-hover)] hover:text-white"
            >
              Open full library
            </Link>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Shapes" icon={<Shapes className="h-4 w-4 text-[var(--studio-ink-subtle)]" />}>
        <div className="grid grid-cols-4 gap-2">
          {HTV_SHAPES.map((shape) => (
            <button
              key={shape.id}
              onClick={() => onAddShape(shape.id)}
              title={shape.displayName}
              aria-label={shape.displayName}
              className="flex aspect-square items-center justify-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] p-2 text-[var(--studio-ink-secondary)] transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-ink)]"
            >
              <ShapeThumbnail shapeId={shape.id} className="h-full w-full" />
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Design templates" icon={<Sparkles className="h-4 w-4 text-[var(--studio-ink-subtle)]" />}>
        <div className="grid gap-2">
          {HTV_DESIGN_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onAddTemplate(template.id)}
              className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-left transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]"
            >
              <div className="text-sm font-medium text-[var(--studio-ink)]">{template.displayName}</div>
              <div className="mt-1 text-[11px] leading-5 text-[var(--studio-ink-subtle)]">{template.description}</div>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Color palettes" icon={<Palette className="h-4 w-4 text-[var(--studio-ink-subtle)]" />}>
        <p className="text-[11px] text-[var(--studio-ink-subtle)]">Applies across your layers in stack order.</p>
        <div className="space-y-2">
          {HTV_COLOR_PALETTES.map((palette) => (
            <button
              key={palette.id}
              disabled={state.layers.length === 0}
              onClick={() => dispatch({ type: 'APPLY_COLOR_PALETTE', colorIds: palette.colorIds })}
              className="overflow-hidden rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] text-left transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-center">
                <div className="min-w-0 flex-1 px-3 py-2">
                  <div className="text-sm font-medium text-[var(--studio-ink)]">{palette.displayName}</div>
                </div>
                <div className="flex h-10 w-32 overflow-hidden border-l border-[var(--studio-border)]">
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
            className="w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-2)] px-3 py-2 text-sm font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-surface-hover)] hover:text-white"
          >
            More
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Garment & placement" icon={<Shirt className="h-4 w-4 text-[var(--studio-ink-subtle)]" />}>
        <div className="space-y-3 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] p-3">
          <div className="inline-flex rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1">
            {(['canvas', 'garment', '3d'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => onToggleDesignSurface(surface)}
                className={`rounded px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition ${designSurface === surface ? 'bg-violet-500/35 text-white' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
              >
                {surface}
              </button>
            ))}
          </div>
          <div className="text-[11px] leading-5 text-[var(--studio-ink-subtle)]">
            {designSurface === 'garment'
              ? 'Design directly on the garment preview with placement context.'
              : designSurface === '3d'
                ? 'Rotate a 3D preview of the front print — an alternate view, not a replacement for the garment photo.'
                : 'Design on the neutral cut canvas for shape-first work.'}
          </div>
          {designSurface === 'garment' && (
            <div className="space-y-1.5 border-t border-[var(--studio-border)] pt-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-subtle)]">Garment overlays</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => onTogglePlacementOverlayMode('active-only')}
                  className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition ${placementOverlayMode === 'active-only' ? 'bg-violet-500/35 text-white' : 'bg-[var(--studio-surface)] text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
                >
                  Only active
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePlacementOverlayMode('all-active')}
                  className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition ${placementOverlayMode === 'all-active' ? 'bg-violet-500/35 text-white' : 'bg-[var(--studio-surface)] text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
                >
                  Show all active
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {GARMENTS.map((garment) => (
            <button
              key={garment.id}
              onClick={() => {
                const nextPlacements = getPlacementsForGarmentType(garment.id as GarmentType);
                const firstPlacement = nextPlacements[0]?.id ?? 'full-front';
                dispatch({
                  type: 'UPDATE_GARMENT',
                  updates: {
                    type: garment.id as GarmentType,
                    size: garment.availableSizes[0] ?? 'M',
                    placementZone: firstPlacement,
                    activePlacementZones: [firstPlacement],
                  },
                });
              }}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${state.garment.type === garment.id ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-muted)] hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-ink)]'}`}
            >
              {garment.displayName}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-subtle)]">Print placements</span>
          <div className="space-y-2">
            {placementDefinitions.map((zone) => {
              const enabled = state.garment.activePlacementZones.includes(zone.id);
              const selected = state.garment.placementZone === zone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => togglePlacement(zone.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${selected ? 'border-violet-400/70 bg-violet-500/20 text-white' : enabled ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-[var(--studio-ink)]' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-muted)] hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-ink)]'}`}
                >
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${enabled ? 'bg-fuchsia-500 text-white' : 'bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-subtle)]'}`}>
                    {enabled ? '✓' : '+'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium uppercase tracking-[0.12em]">{zone.displayName}</span>
                    <span className="block text-[10px] opacity-80">{zone.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-subtle)]">Garment color</span>
            <span className="text-[11px] text-[var(--studio-ink-subtle)]">{activeGarmentColor.name}</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {GARMENT_COLORS.map((swatch) => (
              <button
                key={swatch.id}
                title={swatch.name}
                aria-label={swatch.name}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { colorId: swatch.id } })}
                className={`aspect-square rounded-md border-2 transition ${state.garment.colorId === swatch.id ? 'border-white shadow-[0_0_0_1px_rgba(139,92,246,0.9)]' : 'border-[var(--studio-border)]'}`}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-2)] px-3 py-2 text-sm font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-surface-hover)] hover:text-white"
          >
            Import
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-subtle)]">Size</span>
          <div className="grid grid-cols-5 gap-1">
            {garmentDefinition.availableSizes.map((size) => (
              <button
                key={size}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { size: size as GarmentSize } })}
                className={`rounded-lg border px-1 py-1.5 text-xs font-medium transition ${state.garment.size === size ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-muted)] hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-ink)]'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-subtle)]">Placement</span>
          <div className="space-y-1">
            {placementDefinitions.map((zone) => (
              <button
                key={zone.id}
                onClick={() => dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: zone.id as HtvPlacementZone } })}
                className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${state.garment.placementZone === zone.id ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-muted)] hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-ink)]'}`}
              >
                <div className="font-medium">{zone.displayName}</div>
                <div className="text-[10px] text-[var(--studio-ink-subtle)]">{zone.description}</div>
              </button>
            ))}
          </div>
        </div>
      </PanelSection>
    </aside>
  );
}
