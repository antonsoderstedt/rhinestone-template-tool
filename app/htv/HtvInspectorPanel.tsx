'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import NumericInput from '../editor/controls/NumericInput';
import type { HtvAction, HtvLayer, HtvState } from './HtvState';
import { HTV_COLORS, getHtvColor } from './htvMaterialCatalog';
import { listOutlineFonts } from '@/src/lib/rhinestone-engine/index';

interface HtvInspectorPanelProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
}

export default function HtvInspectorPanel({ state, dispatch }: HtvInspectorPanelProps) {
  const selectedLayers = state.layers.filter((l) => state.selectedLayerIds.has(l.id));
  const singleLayer = selectedLayers.length === 1 ? selectedLayers[0]! : null;

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-border bg-surface-raised/90 p-4">
      <section className="space-y-3 rounded-2xl border border-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-ink">Inspector</h3>
        {selectedLayers.length === 0 ? (
          <p className="text-xs text-ink-muted">Select a layer to edit its position, color, and other properties.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ink-muted">
              {selectedLayers.length === 1 ? singleLayer!.name : `${selectedLayers.length} layers selected`}
            </p>

            {singleLayer?.type === 'text' && <TextLayerControls layer={singleLayer} dispatch={dispatch} />}

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
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-ink">Layers</h3>
        {state.layers.length === 0 ? (
          <p className="text-xs text-ink-muted">No layers yet. Add text or import artwork to get started.</p>
        ) : (
          <ul className="space-y-1">
            {[...state.layers].reverse().map((layer) => (
              <LayerRow key={layer.id} layer={layer} selected={state.selectedLayerIds.has(layer.id)} dispatch={dispatch} />
            ))}
          </ul>
        )}
      </section>
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

function LayerRow({ layer, selected, dispatch }: { layer: HtvLayer; selected: boolean; dispatch: React.Dispatch<HtvAction> }) {
  const color = getHtvColor(layer.colorId);
  return (
    <li
      onClick={() => dispatch({ type: 'SET_SELECTED_LAYERS', ids: [layer.id] })}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer ${selected ? 'border-accent-400 bg-accent-50' : 'border-border bg-surface-sunken hover:bg-surface-raised'}`}
    >
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
