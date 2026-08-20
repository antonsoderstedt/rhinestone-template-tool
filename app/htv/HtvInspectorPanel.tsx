'use client';

import { useMemo, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronsDown,
  ChevronsUp,
  Combine,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  GripVertical,
  Layers2,
  Lock,
  StretchHorizontal,
  StretchVertical,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import NumericInput from '../editor/controls/NumericInput';
import { expandSelectionToGroups, type HtvAction, type HtvLayer, type HtvState } from './HtvState';
import { HTV_COLORS, getHtvColor } from './htvMaterialCatalog';
import { HTV_TEXT_PRESETS } from './htvTextPresets';
import { computeBoundsForLayers, computePolylinesBounds, HTV_WORKSPACE_SIZE_MM, polylinesToPathD, transformedLayerBounds } from './htvGeometry';
import { useHtvTextGeometry } from './useHtvTextGeometry';
import { listOutlineFonts, type Polyline } from '@/src/lib/rhinestone-engine/index';

interface HtvInspectorPanelProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
  onCombineLayers: (ids: string[]) => void;
  onOffsetLayer: (id: string, offsetMm: number) => void;
}

const SHAPE_SIZE_PRESETS: readonly { id: string; displayName: string; targetMm: number }[] = [
  { id: 'small', displayName: 'S', targetMm: 25 },
  { id: 'medium', displayName: 'M', targetMm: 50 },
  { id: 'large', displayName: 'L', targetMm: 100 },
];

function PanelSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-white/10 bg-[#202024] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        <span className="text-xs font-semibold text-zinc-500 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-white/10 px-3 py-3">{children}</div>
    </details>
  );
}

export default function HtvInspectorPanel({ state, dispatch, onCombineLayers, onOffsetLayer }: HtvInspectorPanelProps) {
  const selectedLayers = state.layers.filter((l) => state.selectedLayerIds.has(l.id));
  const singleLayer = selectedLayers.length === 1 ? selectedLayers[0]! : null;

  return (
    <aside className="htv-dark-panel flex h-full w-full flex-col gap-3 overflow-y-auto border-l border-white/10 bg-[#252529] p-3 backdrop-blur-xl">
      <PanelSection title="Inspector">
        {selectedLayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface px-3 py-4 text-xs leading-6 text-ink-muted">
            Select a layer to edit its position, color, and other properties.
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ink-muted">
              {selectedLayers.length === 1 ? singleLayer!.name : `${selectedLayers.length} layers selected`}
            </p>

            {singleLayer?.type === 'text' && <TextLayerControls layer={singleLayer} dispatch={dispatch} />}
            {singleLayer?.type === 'vector' && <ShapeLayerControls layer={singleLayer} dispatch={dispatch} />}
            {singleLayer?.type === 'vector' && singleLayer.polylines.length > 1 && (
              <ContourControls layer={singleLayer} dispatch={dispatch} />
            )}

            <FormOpsControls selected={selectedLayers} onCombineLayers={onCombineLayers} onOffsetLayer={onOffsetLayer} />

            <ArrangeControls selected={selectedLayers} dispatch={dispatch} />

            <div className="grid grid-cols-2 gap-2">
              <NumericInput
                label="X"
                unit="mm"
                value={singleLayer ? Math.round(singleLayer.x * 10) / 10 : ''}
                onChange={(v) => selectedLayers.forEach((l) => dispatch({ type: 'UPDATE_LAYER', id: l.id, updates: { x: typeof v === 'number' ? v : l.x } }))}
              />
              <NumericInput
                label="Y"
                unit="mm"
                value={singleLayer ? Math.round(singleLayer.y * 10) / 10 : ''}
                onChange={(v) => selectedLayers.forEach((l) => dispatch({ type: 'UPDATE_LAYER', id: l.id, updates: { y: typeof v === 'number' ? v : l.y } }))}
              />
              <NumericInput
                label="Rotation"
                unit="°"
                value={singleLayer ? singleLayer.rotationDeg : ''}
                min={-180}
                max={180}
                onChange={(v) => {
                  const value = typeof v === 'number' ? v : 0;
                  dispatch({ type: 'UPDATE_LAYERS', ids: selectedLayers.map((l) => l.id), updates: { rotationDeg: value } });
                }}
              />
              <NumericInput
                label="Scale"
                unit="×"
                value={singleLayer ? Math.round(singleLayer.scale * 100) / 100 : ''}
                min={0.1}
                max={10}
                step={0.05}
                onChange={(v) => {
                  const value = typeof v === 'number' ? v : 1;
                  dispatch({ type: 'UPDATE_LAYERS', ids: selectedLayers.map((l) => l.id), updates: { scale: value } });
                }}
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-secondary">HTV color</span>
              <div className="grid grid-cols-6 gap-1.5">
                {HTV_COLORS.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    title={swatch.name}
                    aria-label={swatch.name}
                    onClick={() => dispatch({ type: 'UPDATE_LAYERS', ids: selectedLayers.map((l) => l.id), updates: { colorId: swatch.id } })}
                    className={`aspect-square rounded-full border-2 transition ${singleLayer?.colorId === swatch.id ? 'border-accent-500' : 'border-border'}`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => dispatch({ type: 'DUPLICATE_LAYERS', ids: selectedLayers.map((l) => l.id) })}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              <button
                onClick={() => dispatch({ type: 'DELETE_LAYERS', ids: selectedLayers.map((l) => l.id) })}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600 transition hover:bg-danger-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Layers">
        {state.layers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface px-3 py-4 text-xs leading-6 text-ink-muted">
            No layers yet. Add text or import artwork to get started.
          </div>
        ) : (
          <LayerList state={state} dispatch={dispatch} />
        )}
      </PanelSection>
    </aside>
  );
}

function TextLayerControls({ layer, dispatch }: { layer: Extract<HtvLayer, { type: 'text' }>; dispatch: React.Dispatch<HtvAction> }) {
  const outlineFonts = useMemo(() => listOutlineFonts().filter((font) => !font.isLegacy), []);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-sunken p-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Text</span>
        <textarea
          value={layer.text}
          onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { text: e.target.value } })}
          rows={2}
          className="rounded border border-border bg-surface-raised px-2 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Font</span>
        <select
          value={layer.fontId}
          onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { fontId: e.target.value } })}
          className="rounded border border-border bg-surface-raised px-2 py-2 text-sm text-ink"
        >
          {outlineFonts.map((font) => (
            <option key={font.fontId} value={font.fontId}>
              {font.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-ink-secondary">Style presets</span>
        <div className="grid grid-cols-2 gap-1.5">
          {HTV_TEXT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => dispatch({
                type: 'UPDATE_LAYER',
                id: layer.id,
                updates: {
                  fontSizeMm: preset.fontSizeMm,
                  letterSpacingMm: preset.letterSpacingMm,
                  curveAmount: preset.curveAmount,
                  align: preset.align,
                },
              })}
              className="rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-left text-[11px] font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink"
            >
              {preset.displayName}
            </button>
          ))}
        </div>
      </div>

      <NumericInput
        label="Font size"
        unit="mm"
        value={layer.fontSizeMm}
        min={5}
        max={300}
        onChange={(v) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { fontSizeMm: typeof v === 'number' ? v : layer.fontSizeMm } })}
      />
      <NumericInput
        label="Letter spacing"
        unit="mm"
        value={layer.letterSpacingMm}
        min={-5}
        max={50}
        step={0.5}
        onChange={(v) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { letterSpacingMm: typeof v === 'number' ? v : layer.letterSpacingMm } })}
      />

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-xs font-medium text-ink-secondary">
          <span>Curve</span>
          <span className="text-ink-muted">{layer.curveAmount}</span>
        </span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={layer.curveAmount}
          onChange={(e) => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { curveAmount: Number(e.target.value) } })}
          className="w-full accent-accent-500"
        />
      </label>

      <div className="grid grid-cols-3 gap-1.5">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            onClick={() => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { align } })}
            className={`rounded-lg border px-2 py-1.5 text-xs capitalize transition ${layer.align === align ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-raised text-ink-secondary'}`}
          >
            {align}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapeLayerControls({ layer, dispatch }: { layer: Extract<HtvLayer, { type: 'vector' }>; dispatch: React.Dispatch<HtvAction> }) {
  const baseSizeMm = Math.max(layer.naturalWidthMm, layer.naturalHeightMm, 0.001);
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-surface-sunken p-3">
      <span className="text-xs font-medium text-ink-secondary">Size presets</span>
      <div className="grid grid-cols-3 gap-1.5">
        {SHAPE_SIZE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { scale: preset.targetMm / baseSizeMm } })}
            className="rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink"
            title={`${preset.targetMm}mm`}
          >
            {preset.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContourControls({ layer, dispatch }: { layer: Extract<HtvLayer, { type: 'vector' }>; dispatch: React.Dispatch<HtvAction> }) {
  const toggle = (index: number) => {
    const excluded = new Set(layer.excludedContours);
    if (excluded.has(index)) excluded.delete(index);
    else excluded.add(index);
    dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { excludedContours: [...excluded].sort((a, b) => a - b) } });
  };

  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-surface-sunken p-3">
      <span className="text-xs font-medium text-ink-secondary">Contour</span>
      <p className="text-[11px] text-ink-muted">Hide sub-paths you don&apos;t want cut, e.g. stray traced lines.</p>
      <div className="space-y-1">
        {layer.polylines.map((pl, i) => {
          const hidden = layer.excludedContours.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${hidden ? 'border-border bg-surface-raised text-ink-muted' : 'border-accent-400 bg-accent-50 text-ink'}`}
            >
              {hidden ? <EyeOff className="h-3.5 w-3.5 shrink-0" /> : <Eye className="h-3.5 w-3.5 shrink-0" />}
              <span>Sub-path {i + 1}</span>
              <span className="ml-auto text-[10px] text-ink-muted">{pl.points.length} pts</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormOpsControls({
  selected,
  onCombineLayers,
  onOffsetLayer,
}: {
  selected: HtvLayer[];
  onCombineLayers: (ids: string[]) => void;
  onOffsetLayer: (id: string, offsetMm: number) => void;
}) {
  const [offsetMm, setOffsetMm] = useState(3);
  const allVector = selected.length > 0 && selected.every((l) => l.type === 'vector');
  if (!allVector) return null;

  const canCombine = selected.length >= 2;
  const canOffset = selected.length === 1;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-sunken p-3">
      <span className="text-xs font-medium text-ink-secondary">Form operations</span>
      <button
        onClick={() => onCombineLayers(selected.map((l) => l.id))}
        disabled={!canCombine}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        title={canCombine ? 'Merge selected shapes into one layer' : 'Select 2+ shapes to combine'}
      >
        <Combine className="h-3.5 w-3.5" />
        Combine ({selected.length})
      </button>

      <div className={`flex items-end gap-2 ${canOffset ? '' : 'opacity-40'}`}>
        <NumericInput
          label="Offset"
          unit="mm"
          value={offsetMm}
          min={-15}
          max={15}
          step={0.5}
          disabled={!canOffset}
          onChange={(v) => setOffsetMm(typeof v === 'number' ? v : offsetMm)}
        />
        <button
          onClick={() => canOffset && onOffsetLayer(selected[0]!.id, offsetMm)}
          disabled={!canOffset}
          className="mb-0.5 inline-flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 text-xs font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          title="Add a new outline layer offset from this shape"
        >
          <Layers2 className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}

function ArrangeControls({ selected, dispatch }: { selected: HtvLayer[]; dispatch: React.Dispatch<HtvAction> }) {
  const half = HTV_WORKSPACE_SIZE_MM / 2;
  const bbox = selected.length >= 2
    ? computeBoundsForLayers(selected)
    : { minX: -half, minY: -half, maxX: half, maxY: half, width: HTV_WORKSPACE_SIZE_MM, height: HTV_WORKSPACE_SIZE_MM };

  const align = (axis: 'x' | 'y', mode: 'start' | 'center' | 'end') => {
    if (!bbox) return;
    const updates = selected.map((layer) => {
      const b = transformedLayerBounds(layer);
      if (axis === 'x') {
        const extent = (b.maxX - b.minX) / 2;
        const x = mode === 'start' ? bbox.minX + extent : mode === 'end' ? bbox.maxX - extent : (bbox.minX + bbox.maxX) / 2;
        return { id: layer.id, updates: { x } };
      }
      const extent = (b.maxY - b.minY) / 2;
      const y = mode === 'start' ? bbox.minY + extent : mode === 'end' ? bbox.maxY - extent : (bbox.minY + bbox.maxY) / 2;
      return { id: layer.id, updates: { y } };
    });
    dispatch({ type: 'BATCH_UPDATE_LAYERS', updates });
  };

  const distribute = (axis: 'x' | 'y') => {
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const firstVal = axis === 'x' ? first.x : first.y;
    const lastVal = axis === 'x' ? last.x : last.y;
    const step = (lastVal - firstVal) / (sorted.length - 1);
    const updates = sorted.map((layer, i) => ({
      id: layer.id,
      updates: axis === 'x' ? { x: firstVal + step * i } : { y: firstVal + step * i },
    }));
    dispatch({ type: 'BATCH_UPDATE_LAYERS', updates });
  };

  const toggleFlipX = () => dispatch({ type: 'BATCH_UPDATE_LAYERS', updates: selected.map((l) => ({ id: l.id, updates: { flipX: !l.flipX } })) });
  const toggleFlipY = () => dispatch({ type: 'BATCH_UPDATE_LAYERS', updates: selected.map((l) => ({ id: l.id, updates: { flipY: !l.flipY } })) });

  const canGroup = selected.length >= 2;
  const canUngroup = selected.some((l) => l.groupId !== null);
  const group = () => dispatch({ type: 'UPDATE_LAYERS', ids: selected.map((l) => l.id), updates: { groupId: crypto.randomUUID() } });
  const ungroup = () => dispatch({ type: 'UPDATE_LAYERS', ids: selected.map((l) => l.id), updates: { groupId: null } });

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-sunken p-3">
      <span className="text-xs font-medium text-ink-secondary">Arrange</span>

      <div className="grid grid-cols-6 gap-1">
        <ArrangeButton title="Align left" onClick={() => align('x', 'start')}><AlignStartVertical className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Align center (horizontal)" onClick={() => align('x', 'center')}><AlignCenterVertical className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Align right" onClick={() => align('x', 'end')}><AlignEndVertical className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Align top" onClick={() => align('y', 'start')}><AlignStartHorizontal className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Align middle (vertical)" onClick={() => align('y', 'center')}><AlignCenterHorizontal className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Align bottom" onClick={() => align('y', 'end')}><AlignEndHorizontal className="h-3.5 w-3.5" /></ArrangeButton>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <ArrangeButton title="Flip horizontal" onClick={toggleFlipX}><FlipHorizontal2 className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Flip vertical" onClick={toggleFlipY}><FlipVertical2 className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Distribute horizontally" disabled={selected.length < 3} onClick={() => distribute('x')}><StretchHorizontal className="h-3.5 w-3.5" /></ArrangeButton>
        <ArrangeButton title="Distribute vertically" disabled={selected.length < 3} onClick={() => distribute('y')}><StretchVertical className="h-3.5 w-3.5" /></ArrangeButton>
      </div>

      {(canGroup || canUngroup) && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            onClick={group}
            disabled={!canGroup}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Boxes className="h-3.5 w-3.5" />
            Group
          </button>
          <button
            onClick={ungroup}
            disabled={!canUngroup}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Ungroup className="h-3.5 w-3.5" />
            Ungroup
          </button>
        </div>
      )}
    </div>
  );
}

function ArrangeButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center rounded-lg border border-border bg-surface-raised py-1.5 text-ink-secondary transition hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function LayerList({ state, dispatch }: { state: HtvState; dispatch: React.Dispatch<HtvAction> }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Display top-to-bottom in front-to-back order; state.layers is stored back-to-front.
  const displayLayers = [...state.layers].reverse();

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const next = [...displayLayers];
    const fromIndex = next.findIndex((l) => l.id === draggedId);
    const toIndex = next.findIndex((l) => l.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved!);
    dispatch({ type: 'SET_LAYER_ORDER', orderedIds: [...next].reverse().map((l) => l.id) });
    setDraggedId(null);
  };

  return (
    <ul className="space-y-1">
      {displayLayers.map((layer) => (
        <LayerRow
          key={layer.id}
          layer={layer}
          allLayers={state.layers}
          selected={state.selectedLayerIds.has(layer.id)}
          dispatch={dispatch}
          dragging={draggedId === layer.id}
          onDragStart={() => setDraggedId(layer.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(layer.id)}
          onDragEnd={() => setDraggedId(null)}
        />
      ))}
    </ul>
  );
}

function LayerThumbnail({ layer }: { layer: HtvLayer }) {
  if (layer.type === 'text') return <TextLayerThumbnail layer={layer} />;
  return <PolylineThumbnail polylines={layer.polylines} />;
}

function TextLayerThumbnail({ layer }: { layer: Extract<HtvLayer, { type: 'text' }> }) {
  const polylines = useHtvTextGeometry(layer);
  if (!polylines || polylines.length === 0) {
    return <div className="h-6 w-6 shrink-0 rounded bg-surface-sunken" />;
  }
  return <PolylineThumbnail polylines={polylines} />;
}

function PolylineThumbnail({ polylines }: { polylines: Polyline[] }) {
  const bounds = computePolylinesBounds(polylines);
  const pad = Math.max(bounds.width, bounds.height) * 0.1 + 0.5;
  const viewBox = `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.width + pad * 2 || 1} ${bounds.height + pad * 2 || 1}`;
  return (
    <svg viewBox={viewBox} className="h-6 w-6 shrink-0 text-ink-secondary">
      <path d={polylinesToPathD(polylines)} fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}

function LayerRow({
  layer,
  allLayers,
  selected,
  dispatch,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  layer: HtvLayer;
  allLayers: HtvLayer[];
  selected: boolean;
  dispatch: React.Dispatch<HtvAction>;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const color = getHtvColor(layer.colorId);
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => dispatch({ type: 'SET_SELECTED_LAYERS', ids: expandSelectionToGroups(allLayers, [layer.id]) })}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer ${dragging ? 'opacity-40' : ''} ${selected ? 'border-accent-400 bg-accent-50' : 'border-border bg-surface-sunken hover:bg-surface-raised'}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-ink-muted" />
      <LayerThumbnail layer={layer} />
      <span className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: color.hex }} />
      <span className="min-w-0 flex-1 truncate text-ink">{layer.type === 'text' ? layer.text || 'Text' : layer.name}</span>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { visible: !layer.visible } }); }} className="text-ink-muted hover:text-ink" title={layer.visible ? 'Hide' : 'Show'}>
        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_LAYER', id: layer.id, updates: { locked: !layer.locked } }); }} className="text-ink-muted hover:text-ink" title={layer.locked ? 'Unlock' : 'Lock'}>
        {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', id: layer.id, direction: 'front' }); }} className="text-ink-muted hover:text-ink" title="Bring to front">
        <ChevronsUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', id: layer.id, direction: 'up' }); }} className="text-ink-muted hover:text-ink" title="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', id: layer.id, direction: 'down' }); }} className="text-ink-muted hover:text-ink" title="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REORDER_LAYER', id: layer.id, direction: 'back' }); }} className="text-ink-muted hover:text-ink" title="Send to back">
        <ChevronsDown className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
