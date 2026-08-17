'use client';

import { useRef, useState } from 'react';
import { Minus, Plus, Scan } from 'lucide-react';
import { expandSelectionToGroups, type HtvAction, type HtvLayer, type HtvState } from './HtvState';
import HtvLayerShape from './HtvLayerShape';
import { approximateLayerBounds, HTV_WORKSPACE_SIZE_MM, transformedLayerBounds } from './htvGeometry';

interface HtvCanvasProps {
  state: HtvState;
  dispatch: React.Dispatch<HtvAction>;
}

const WORKSPACE_SIZE_MM = HTV_WORKSPACE_SIZE_MM;

/** setPointerCapture can throw NotFoundError in edge cases (fast clicks, some stylus/trackpad drivers) — capture is a nice-to-have for drags that leave the handle, not a precondition for starting one. */
function trySetPointerCapture(target: EventTarget | null, pointerId: number) {
  try {
    (target as Element)?.setPointerCapture?.(pointerId);
  } catch {
    // ignore — the drag still works via document-level pointermove/up
  }
}

type Interaction =
  | { kind: 'move'; pointerId: number; startClientX: number; startClientY: number; originalPositions: Map<string, { x: number; y: number }>; moved: boolean }
  | { kind: 'scale'; pointerId: number; layerId: string; centerX: number; centerY: number; initialDistance: number; initialScale: number }
  | { kind: 'rotate'; pointerId: number; layerId: string; centerX: number; centerY: number }
  | { kind: 'marquee'; pointerId: number; startMmX: number; startMmY: number; curMmX: number; curMmY: number; moved: boolean };

export default function HtvCanvas({ state, dispatch }: HtvCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);

  const viewBoxSize = WORKSPACE_SIZE_MM / state.canvas.zoom;
  const viewBoxX = -viewBoxSize / 2 + state.canvas.panX;
  const viewBoxY = -viewBoxSize / 2 + state.canvas.panY;

  const mmPerClientPx = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 1, y: 1 };
    return { x: viewBoxSize / rect.width, y: viewBoxSize / rect.height };
  };

  const clientToMm = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    const scale = mmPerClientPx();
    return { x: viewBoxX + (clientX - rect.left) * scale.x, y: viewBoxY + (clientY - rect.top) * scale.y };
  };

  const handleLayerPointerDown = (event: React.PointerEvent<SVGGElement>, layer: HtvLayer) => {
    event.stopPropagation();
    if (layer.locked) return;

    const alreadySelected = state.selectedLayerIds.has(layer.id);
    let nextSelection: string[];
    if (event.shiftKey) {
      nextSelection = alreadySelected
        ? [...state.selectedLayerIds].filter((id) => id !== layer.id)
        : expandSelectionToGroups(state.layers, [...state.selectedLayerIds, layer.id]);
    } else {
      nextSelection = alreadySelected ? [...state.selectedLayerIds] : expandSelectionToGroups(state.layers, [layer.id]);
    }
    dispatch({ type: 'SET_SELECTED_LAYERS', ids: nextSelection });

    const originalPositions = new Map<string, { x: number; y: number }>();
    for (const l of state.layers) {
      if (nextSelection.includes(l.id)) originalPositions.set(l.id, { x: l.x, y: l.y });
    }

    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({
      kind: 'move',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalPositions,
      moved: false,
    });
  };

  const handleScaleHandlePointerDown = (event: React.PointerEvent<SVGRectElement>, layer: HtvLayer, corner: { x: number; y: number }) => {
    event.stopPropagation();
    const initialDistance = Math.max(Math.hypot(corner.x - layer.x, corner.y - layer.y), 0.001);
    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({ kind: 'scale', pointerId: event.pointerId, layerId: layer.id, centerX: layer.x, centerY: layer.y, initialDistance, initialScale: layer.scale });
  };

  const handleRotateHandlePointerDown = (event: React.PointerEvent<SVGCircleElement>, layer: HtvLayer) => {
    event.stopPropagation();
    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({ kind: 'rotate', pointerId: event.pointerId, layerId: layer.id, centerX: layer.x, centerY: layer.y });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;

    if (interaction.kind === 'move') {
      const scale = mmPerClientPx();
      const dx = (event.clientX - interaction.startClientX) * scale.x;
      const dy = (event.clientY - interaction.startClientY) * scale.y;
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && !interaction.moved) return;
      for (const [id, original] of interaction.originalPositions) {
        dispatch({ type: 'UPDATE_LAYER', id, updates: { x: original.x + dx, y: original.y + dy } });
      }
      setInteraction({ ...interaction, moved: true });
      return;
    }

    if (interaction.kind === 'scale') {
      const mm = clientToMm(event.clientX, event.clientY);
      const distance = Math.hypot(mm.x - interaction.centerX, mm.y - interaction.centerY);
      const nextScale = Math.min(Math.max((distance / interaction.initialDistance) * interaction.initialScale, 0.05), 30);
      dispatch({ type: 'UPDATE_LAYER', id: interaction.layerId, updates: { scale: nextScale } });
      return;
    }

    if (interaction.kind === 'rotate') {
      const mm = clientToMm(event.clientX, event.clientY);
      const angleDeg = (Math.atan2(mm.y - interaction.centerY, mm.x - interaction.centerX) * 180) / Math.PI;
      dispatch({ type: 'UPDATE_LAYER', id: interaction.layerId, updates: { rotationDeg: angleDeg + 90 } });
      return;
    }

    if (interaction.kind === 'marquee') {
      const mm = clientToMm(event.clientX, event.clientY);
      const moved = interaction.moved || Math.abs(mm.x - interaction.startMmX) > 0.5 || Math.abs(mm.y - interaction.startMmY) > 0.5;
      setInteraction({ ...interaction, curMmX: mm.x, curMmY: mm.y, moved });
    }
  };

  const handlePointerUp = () => {
    if (interaction?.kind === 'marquee') {
      if (interaction.moved) {
        const minX = Math.min(interaction.startMmX, interaction.curMmX);
        const maxX = Math.max(interaction.startMmX, interaction.curMmX);
        const minY = Math.min(interaction.startMmY, interaction.curMmY);
        const maxY = Math.max(interaction.startMmY, interaction.curMmY);
        const hits = state.layers
          .filter((l) => l.visible && !l.locked)
          .filter((l) => {
            const b = transformedLayerBounds(l);
            return b.minX <= maxX && b.maxX >= minX && b.minY <= maxY && b.maxY >= minY;
          })
          .map((l) => l.id);
        dispatch({ type: 'SET_SELECTED_LAYERS', ids: expandSelectionToGroups(state.layers, hits) });
      } else if (state.selectedLayerIds.size > 0) {
        dispatch({ type: 'SET_SELECTED_LAYERS', ids: [] });
      }
    }
    setInteraction(null);
  };

  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const mm = clientToMm(event.clientX, event.clientY);
    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({ kind: 'marquee', pointerId: event.pointerId, startMmX: mm.x, startMmY: mm.y, curMmX: mm.x, curMmY: mm.y, moved: false });
  };

  const zoomIn = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.min(state.canvas.zoom * 1.2, 5) } });
  const zoomOut = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.max(state.canvas.zoom / 1.2, 0.2) } });
  const resetView = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });

  const singleSelectedLayer =
    state.selectedLayerIds.size === 1 ? state.layers.find((l) => state.selectedLayerIds.has(l.id) && l.visible && !l.locked) ?? null : null;

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
              transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotationDeg}) scale(${layer.scale * (layer.flipX ? -1 : 1)} ${layer.scale * (layer.flipY ? -1 : 1)})`}
              onPointerDown={(e) => handleLayerPointerDown(e, layer)}
              style={{ cursor: layer.locked ? 'not-allowed' : 'move' }}
            >
              <HtvLayerShape layer={layer} />
              {selected && <SelectionOutline layer={layer} />}
            </g>
          );
        })}

        {singleSelectedLayer && (
          <TransformHandles
            layer={singleSelectedLayer}
            zoom={state.canvas.zoom}
            onScaleHandlePointerDown={handleScaleHandlePointerDown}
            onRotateHandlePointerDown={handleRotateHandlePointerDown}
          />
        )}

        {interaction?.kind === 'marquee' && interaction.moved && (
          <rect
            x={Math.min(interaction.startMmX, interaction.curMmX)}
            y={Math.min(interaction.startMmY, interaction.curMmY)}
            width={Math.abs(interaction.curMmX - interaction.startMmX)}
            height={Math.abs(interaction.curMmY - interaction.startMmY)}
            fill="rgba(124,77,255,0.1)"
            stroke="#7c4dff"
            strokeWidth={1 / state.canvas.zoom}
            pointerEvents="none"
          />
        )}
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

function rotatePoint(x: number, y: number, thetaRad: number): { x: number; y: number } {
  return {
    x: x * Math.cos(thetaRad) - y * Math.sin(thetaRad),
    y: x * Math.sin(thetaRad) + y * Math.cos(thetaRad),
  };
}

function TransformHandles({
  layer,
  zoom,
  onScaleHandlePointerDown,
  onRotateHandlePointerDown,
}: {
  layer: HtvLayer;
  zoom: number;
  onScaleHandlePointerDown: (event: React.PointerEvent<SVGRectElement>, layer: HtvLayer, corner: { x: number; y: number }) => void;
  onRotateHandlePointerDown: (event: React.PointerEvent<SVGCircleElement>, layer: HtvLayer) => void;
}) {
  const { width, height } = approximateLayerBounds(layer);
  const padding = Math.max(width, height) * 0.06 + 1.5;
  const hw = (width / 2 + padding) * layer.scale;
  const hh = (height / 2 + padding) * layer.scale;
  const theta = (layer.rotationDeg * Math.PI) / 180;
  const handleSize = 7 / zoom;
  const rotateOffset = 18 / zoom;

  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((p) => {
    const r = rotatePoint(p.x, p.y, theta);
    return { x: layer.x + r.x, y: layer.y + r.y };
  });

  const rotateHandleLocal = rotatePoint(0, -hh - rotateOffset, theta);
  const rotateHandle = { x: layer.x + rotateHandleLocal.x, y: layer.y + rotateHandleLocal.y };
  const topCenterLocal = rotatePoint(0, -hh, theta);
  const topCenter = { x: layer.x + topCenterLocal.x, y: layer.y + topCenterLocal.y };

  return (
    <g pointerEvents="none">
      <line x1={topCenter.x} y1={topCenter.y} x2={rotateHandle.x} y2={rotateHandle.y} stroke="#7c4dff" strokeWidth={1 / zoom} />
      {corners.map((corner, i) => (
        <rect
          key={i}
          x={corner.x - handleSize / 2}
          y={corner.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke="#7c4dff"
          strokeWidth={1.2 / zoom}
          pointerEvents="all"
          style={{ cursor: i % 2 === 0 ? 'nwse-resize' : 'nesw-resize' }}
          onPointerDown={(e) => onScaleHandlePointerDown(e, layer, corner)}
        />
      ))}
      <circle
        cx={rotateHandle.x}
        cy={rotateHandle.y}
        r={handleSize / 1.6}
        fill="#ffffff"
        stroke="#7c4dff"
        strokeWidth={1.2 / zoom}
        pointerEvents="all"
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onRotateHandlePointerDown(e, layer)}
      />
    </g>
  );
}
