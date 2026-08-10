'use client';

import { useRef, useState } from 'react';
import { Minus, Plus, Scan } from 'lucide-react';
import type { HtvAction, HtvLayer, HtvState } from './HtvState';
import HtvLayerShape from './HtvLayerShape';
import { approximateLayerBounds } from './htvGeometry';

interface HtvCanvasProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
}

const WORKSPACE_SIZE_MM = 320;

export default function HtvCanvas({ state, dispatch }: HtvCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originalPositions: Map<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  const viewBoxSize = WORKSPACE_SIZE_MM / state.canvas.zoom;
  const viewBoxX = -viewBoxSize / 2 + state.canvas.panX;
  const viewBoxY = -viewBoxSize / 2 + state.canvas.panY;

  const mmPerClientPx = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 1, y: 1 };
    return { x: viewBoxSize / rect.width, y: viewBoxSize / rect.height };
  };

  const handleLayerPointerDown = (event: React.PointerEvent<SVGGElement>, layer: HtvLayer) => {
    event.stopPropagation();
    if (layer.locked) return;

    const alreadySelected = state.selectedLayerIds.has(layer.id);
    let nextSelection: string[];
    if (event.shiftKey) {
      nextSelection = alreadySelected
        ? [...state.selectedLayerIds].filter((id) => id !== layer.id)
        : [...state.selectedLayerIds, layer.id];
    } else {
      nextSelection = alreadySelected ? [...state.selectedLayerIds] : [layer.id];
    }
    dispatch({ type: 'SET_SELECTED_LAYERS', ids: nextSelection });

    const originalPositions = new Map<string, { x: number; y: number }>();
    for (const l of state.layers) {
      if (nextSelection.includes(l.id)) originalPositions.set(l.id, { x: l.x, y: l.y });
    }

    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalPositions,
      moved: false,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const scale = mmPerClientPx();
    const dx = (event.clientX - dragState.startClientX) * scale.x;
    const dy = (event.clientY - dragState.startClientY) * scale.y;
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && !dragState.moved) return;

    for (const [id, original] of dragState.originalPositions) {
      dispatch({ type: 'UPDATE_LAYER', id, updates: { x: original.x + dx, y: original.y + dy } });
    }
    setDragState({ ...dragState, moved: true });
  };

  const handlePointerUp = () => {
    setDragState(null);
  };

  const handleBackgroundPointerDown = () => {
    if (state.selectedLayerIds.size > 0) {
      dispatch({ type: 'SET_SELECTED_LAYERS', ids: [] });
    }
  };

  const zoomIn = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.min(state.canvas.zoom * 1.2, 5) } });
  const zoomOut = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.max(state.canvas.zoom / 1.2, 0.2) } });
  const resetView = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });

  return (
    <div className="relative flex-1 overflow-hidden bg-sand-100">
      <svg
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxSize} ${viewBoxSize}`}
        className="h-full w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerDown={handleBackgroundPointerDown}
      >
        <rect x={viewBoxX - 1000} y={viewBoxY - 1000} width={viewBoxSize + 2000} height={viewBoxSize + 2000} fill="#f5f1ea" />
        <rect x={-WORKSPACE_SIZE_MM / 2} y={-WORKSPACE_SIZE_MM / 2} width={WORKSPACE_SIZE_MM} height={WORKSPACE_SIZE_MM} fill="#ffffff" stroke="rgba(0,0,0,0.08)" />

        {state.layers.map((layer) => {
          if (!layer.visible) return null;
          const selected = state.selectedLayerIds.has(layer.id);
          return (
            <g
              key={layer.id}
              transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotationDeg}) scale(${layer.scale})`}
              onPointerDown={(e) => handleLayerPointerDown(e, layer)}
              style={{ cursor: layer.locked ? 'not-allowed' : 'move' }}
            >
              <HtvLayerShape layer={layer} />
              {selected && (
                <SelectionOutline layer={layer} />
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-xl border border-border bg-surface-raised p-1 shadow-sm">
        <button onClick={zoomIn} className="rounded-lg p-2 text-ink-secondary hover:bg-surface-sunken hover:text-ink" title="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={zoomOut} className="rounded-lg p-2 text-ink-secondary hover:bg-surface-sunken hover:text-ink" title="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={resetView} className="rounded-lg p-2 text-ink-secondary hover:bg-surface-sunken hover:text-ink" title="Reset view">
          <Scan className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs text-ink-muted shadow-sm">
        {Math.round(state.canvas.zoom * 100)}%
      </div>
    </div>
  );
}

function SelectionOutline({ layer }: { layer: HtvLayer }) {
  const { width, height } = approximateLayerBounds(layer);
  const padding = Math.max(width, height) * 0.06 + 1.5;
  return (
    <rect
      x={-width / 2 - padding}
      y={-height / 2 - padding}
      width={width + padding * 2}
      height={height + padding * 2}
      fill="none"
      stroke="#7c4dff"
      strokeWidth={1.2 / (layer.scale || 1)}
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  );
}
