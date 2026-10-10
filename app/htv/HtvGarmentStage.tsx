'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Scan, Shirt } from 'lucide-react';
import { getGarmentColor, getGarmentDefinition } from '../components/garmentPreview/garmentCatalog';
import { getPlacementViewForZone, getPlacementZoneBox } from './htvPlacementZones';
import { approximateLayerBounds, HTV_WORKSPACE_SIZE_MM, transformedLayerBounds } from './htvGeometry';
import HtvLayerShape from './HtvLayerShape';
import HtvMockupImage from './HtvMockupImage';
import { expandSelectionToGroups, type HtvAction, type HtvLayer, type HtvState } from './HtvState';
import { getHtvMockupView, HTV_MOCKUP_IMAGE_SIZE } from './htvMockupRegistry';

const FIT_MARGIN = 0.9;

function trySetPointerCapture(target: EventTarget | null, pointerId: number) {
  try {
    (target as Element)?.setPointerCapture?.(pointerId);
  } catch {
    // ignore
  }
}

type PlacementProjection = {
  zone: HtvState['garment']['placementZone'];
  zoneBox: { x: number; y: number; width: number; height: number };
  placementLayers: HtvLayer[];
  workspaceScale: number;
  zoneCenterX: number;
  zoneCenterY: number;
};

type Interaction =
  | {
      kind: 'move';
      placementZone: HtvState['garment']['placementZone'];
      workspaceScale: number;
      startClientX: number;
      startClientY: number;
      originalPositions: Map<string, { x: number; y: number }>;
    }
  | {
      kind: 'scale';
      placementZone: HtvState['garment']['placementZone'];
      workspaceScale: number;
      layerId: string;
      centerX: number;
      centerY: number;
      initialDistance: number;
      initialScale: number;
    }
  | {
      kind: 'rotate';
      placementZone: HtvState['garment']['placementZone'];
      workspaceScale: number;
      layerId: string;
      centerX: number;
      centerY: number;
    }
  | {
      kind: 'marquee';
      placementZone: HtvState['garment']['placementZone'];
      workspaceScale: number;
      startMmX: number;
      startMmY: number;
      curMmX: number;
      curMmY: number;
      moved: boolean;
    };

export default function HtvGarmentStage({ state, dispatch, showAllPlacementOverlays }: { state: HtvState; dispatch: React.Dispatch<HtvAction>; showAllPlacementOverlays: boolean }) {
  const { garment, layers } = state;
  const color = getGarmentColor(garment.colorId);
  const garmentDefinition = getGarmentDefinition(garment.type);
  const sceneBackground = color.shade === 'dark'
    ? 'radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 38%), linear-gradient(180deg, #4a4d57, #2a2c33 52%, #1f2026)'
    : 'radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 35%), linear-gradient(180deg, #2a2b31, #1b1c21)';
  const view = getPlacementViewForZone(garment.placementZone);
  const mockupView = getHtvMockupView(garment.type, view);
  const svgRef = useRef<SVGSVGElement>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const placementsForView = useMemo<PlacementProjection[]>(() => (showAllPlacementOverlays ? garment.activePlacementZones : [garment.placementZone])
    .filter((zone) => getPlacementViewForZone(zone) === view)
    .map((zone) => {
      const zoneBox = mockupView.placements[zone] ?? getPlacementZoneBox(garment.type, zone);
      const placementLayers = layers.filter((layer) => layer.placementId === zone && layer.visible);
      const workspaceScale = (Math.min(zoneBox.width, zoneBox.height) * FIT_MARGIN) / HTV_WORKSPACE_SIZE_MM;
      const zoneCenterX = zoneBox.x + zoneBox.width / 2;
      const zoneCenterY = zoneBox.y + zoneBox.height / 2;
      return { zone, zoneBox, placementLayers, workspaceScale, zoneCenterX, zoneCenterY };
    }), [garment.activePlacementZones, garment.placementZone, garment.type, layers, mockupView.placements, showAllPlacementOverlays, view]);
  const activePlacement = placementsForView.find((placement) => placement.zone === garment.placementZone) ?? null;
  const activePlacementLayers = activePlacement?.placementLayers ?? [];
  const otherVisiblePlacementLayerCount = showAllPlacementOverlays ? placementsForView.reduce(
    (sum, placement) => sum + (placement.zone === garment.placementZone ? 0 : placement.placementLayers.length),
    0,
  ) : 0;

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * HTV_MOCKUP_IMAGE_SIZE,
      y: ((clientY - rect.top) / rect.height) * HTV_MOCKUP_IMAGE_SIZE,
    };
  }, []);

  const clientToPlacement = useCallback((clientX: number, clientY: number, placement: PlacementProjection) => {
    const svgPoint = clientToSvg(clientX, clientY);
    if (!svgPoint) return null;
    return {
      x: (svgPoint.x - placement.zoneCenterX) / placement.workspaceScale,
      y: (svgPoint.y - placement.zoneCenterY) / placement.workspaceScale,
    };
  }, [clientToSvg]);

  const handleLayerPointerDown = (event: React.PointerEvent<SVGGElement>, layer: HtvLayer, placement: PlacementProjection) => {
    event.stopPropagation();
    if (layer.locked) return;

    const alreadySelected = state.selectedLayerIds.has(layer.id);
    const nextSelection = event.shiftKey
      ? alreadySelected
        ? [...state.selectedLayerIds].filter((id) => id !== layer.id)
        : expandSelectionToGroups(placement.placementLayers, [...state.selectedLayerIds, layer.id])
      : alreadySelected
        ? [...state.selectedLayerIds]
        : expandSelectionToGroups(placement.placementLayers, [layer.id]);

    if (placement.zone !== garment.placementZone) {
      dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: placement.zone } });
    }
    dispatch({ type: 'SET_SELECTED_LAYERS', ids: nextSelection });

    const originalPositions = new Map<string, { x: number; y: number }>();
    for (const candidate of placement.placementLayers) {
      if (nextSelection.includes(candidate.id)) {
        originalPositions.set(candidate.id, { x: candidate.x, y: candidate.y });
      }
    }

    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({
      kind: 'move',
      placementZone: placement.zone,
      workspaceScale: placement.workspaceScale,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalPositions,
    });
  };

  const handleScaleHandlePointerDown = (
    event: React.PointerEvent<SVGRectElement>,
    layer: HtvLayer,
    placement: PlacementProjection,
    corner: { x: number; y: number },
  ) => {
    event.stopPropagation();
    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({
      kind: 'scale',
      placementZone: placement.zone,
      workspaceScale: placement.workspaceScale,
      layerId: layer.id,
      centerX: layer.x,
      centerY: layer.y,
      initialDistance: Math.max(Math.hypot(corner.x - layer.x, corner.y - layer.y), 0.001),
      initialScale: layer.scale,
    });
  };

  const handleRotateHandlePointerDown = (
    event: React.PointerEvent<SVGCircleElement>,
    layer: HtvLayer,
    placement: PlacementProjection,
  ) => {
    event.stopPropagation();
    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({
      kind: 'rotate',
      placementZone: placement.zone,
      workspaceScale: placement.workspaceScale,
      layerId: layer.id,
      centerX: layer.x,
      centerY: layer.y,
    });
  };

  const applyPointerMove = useCallback((clientX: number, clientY: number) => {
    if (!interaction) return;
    if (interaction.kind === 'move') {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const dxSvg = ((clientX - interaction.startClientX) / rect.width) * HTV_MOCKUP_IMAGE_SIZE;
      const dySvg = ((clientY - interaction.startClientY) / rect.height) * HTV_MOCKUP_IMAGE_SIZE;
      const dx = dxSvg / interaction.workspaceScale;
      const dy = dySvg / interaction.workspaceScale;
      for (const [id, original] of interaction.originalPositions) {
        dispatch({ type: 'UPDATE_LAYER', id, updates: { x: original.x + dx, y: original.y + dy } });
      }
      return;
    }

    const placement = placementsForView.find((item) => item.zone === interaction.placementZone);
    if (!placement) return;
    const mmPoint = clientToPlacement(clientX, clientY, placement);
    if (!mmPoint) return;

    if (interaction.kind === 'scale') {
      const distance = Math.hypot(mmPoint.x - interaction.centerX, mmPoint.y - interaction.centerY);
      const nextScale = Math.min(Math.max((distance / interaction.initialDistance) * interaction.initialScale, 0.05), 30);
      dispatch({ type: 'UPDATE_LAYER', id: interaction.layerId, updates: { scale: nextScale } });
      return;
    }

    if (interaction.kind === 'rotate') {
      const angleDeg = (Math.atan2(mmPoint.y - interaction.centerY, mmPoint.x - interaction.centerX) * 180) / Math.PI;
      dispatch({ type: 'UPDATE_LAYER', id: interaction.layerId, updates: { rotationDeg: angleDeg + 90 } });
      return;
    }

    const moved = interaction.moved || Math.abs(mmPoint.x - interaction.startMmX) > 0.5 || Math.abs(mmPoint.y - interaction.startMmY) > 0.5;
    setInteraction({ ...interaction, curMmX: mmPoint.x, curMmY: mmPoint.y, moved });
  }, [clientToPlacement, dispatch, interaction, placementsForView]);

  const handleSvgPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    applyPointerMove(event.clientX, event.clientY);
  };

  const handleSvgPointerUp = useCallback(() => {
    if (interaction?.kind === 'marquee') {
      const placement = placementsForView.find((item) => item.zone === interaction.placementZone);
      if (!placement) {
        setInteraction(null);
        return;
      }

      if (interaction.moved) {
        const minX = Math.min(interaction.startMmX, interaction.curMmX);
        const maxX = Math.max(interaction.startMmX, interaction.curMmX);
        const minY = Math.min(interaction.startMmY, interaction.curMmY);
        const maxY = Math.max(interaction.startMmY, interaction.curMmY);
        const hits = placement.placementLayers
          .filter((layer) => !layer.locked)
          .filter((layer) => {
            const bounds = transformedLayerBounds(layer);
            return bounds.minX <= maxX && bounds.maxX >= minX && bounds.minY <= maxY && bounds.maxY >= minY;
          })
          .map((layer) => layer.id);
        dispatch({ type: 'SET_SELECTED_LAYERS', ids: expandSelectionToGroups(placement.placementLayers, hits) });
      } else if (state.selectedLayerIds.size > 0) {
        dispatch({ type: 'SET_SELECTED_LAYERS', ids: [] });
      }
    }

    setInteraction(null);
  }, [dispatch, interaction, placementsForView, state.selectedLayerIds.size]);

  useEffect(() => {
    if (!interaction) return;
    const handleWindowPointerMove = (event: PointerEvent) => {
      applyPointerMove(event.clientX, event.clientY);
    };
    const handleWindowPointerUp = () => handleSvgPointerUp();
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [applyPointerMove, handleSvgPointerUp, interaction]);

  const handlePlacementPointerDown = (event: React.PointerEvent<SVGRectElement>, placement: PlacementProjection) => {
    event.stopPropagation();
    if (placement.zone !== garment.placementZone) {
      dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: placement.zone } });
      dispatch({ type: 'SET_SELECTED_LAYERS', ids: [] });
      return;
    }

    const mmPoint = clientToPlacement(event.clientX, event.clientY, placement);
    if (!mmPoint) return;
    trySetPointerCapture(event.target, event.pointerId);
    setInteraction({
      kind: 'marquee',
      placementZone: placement.zone,
      workspaceScale: placement.workspaceScale,
      startMmX: mmPoint.x,
      startMmY: mmPoint.y,
      curMmX: mmPoint.x,
      curMmY: mmPoint.y,
      moved: false,
    });
  };

  const zoomIn = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.min(state.canvas.zoom * 1.2, 5) } });
  const zoomOut = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.max(state.canvas.zoom / 1.2, 0.2) } });
  const resetView = () => dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });

  const singleSelectedLayer =
    state.selectedLayerIds.size === 1
      ? activePlacementLayers.find((layer) => state.selectedLayerIds.has(layer.id) && layer.visible && !layer.locked) ?? null
      : null;

  return (
    <div className="relative flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--studio-surface)] p-4 lg:p-8">
      <div className="absolute left-4 top-4 z-10 max-w-[min(360px,calc(100%-2rem))] rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-3 py-2 shadow-md backdrop-blur-sm">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--studio-ink-subtle)]">Garment canvas</div>
        <div className="mt-1 text-xs text-[var(--studio-ink-muted)]">
          {activePlacementLayers.length > 0
            ? `${activePlacementLayers.length} layer${activePlacementLayers.length === 1 ? '' : 's'} on ${garment.type} · ${garment.placementZone}`
            : otherVisiblePlacementLayerCount > 0
              ? `No layers on ${garment.placementZone} · ${otherVisiblePlacementLayerCount} layer${otherVisiblePlacementLayerCount === 1 ? '' : 's'} on other visible placements are dimmed`
              : 'Add text, shapes, or imported artwork'}
        </div>
      </div>

      <div className="w-full max-w-[780px] rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] p-4 shadow-2xl shadow-black/30 lg:p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--studio-ink-secondary)]">
          <Shirt className="h-4 w-4 text-violet-300" />
          <span>{garmentDefinition.displayName} · {garment.size} · {color.name} · {view}</span>
        </div>
        <div className="relative aspect-[1/1] w-full overflow-hidden rounded-md border border-[var(--studio-border)]" style={{ backgroundImage: sceneBackground }}>
          <div className="absolute inset-0 transition-transform duration-150" style={{ transform: `scale(${state.canvas.zoom})`, transformOrigin: 'center center' }}>
            <HtvMockupImage imageSrc={mockupView.imageSrc} alt={`${garment.type} ${view} mockup`} color={color} />

            <svg
              ref={svgRef}
              viewBox={`0 0 ${HTV_MOCKUP_IMAGE_SIZE} ${HTV_MOCKUP_IMAGE_SIZE}`}
              className="absolute inset-0 h-full w-full touch-none"
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerLeave={handleSvgPointerUp}
            >
              {placementsForView.map((placement) => (
                <g key={placement.zone}>
                  <rect
                    x={placement.zoneBox.x}
                    y={placement.zoneBox.y}
                    width={placement.zoneBox.width}
                    height={placement.zoneBox.height}
                    fill="none"
                    stroke={placement.zone === garment.placementZone ? 'rgba(236,72,153,0.95)' : 'rgba(236,72,153,0.5)'}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    rx="4"
                    onPointerDown={(event) => handlePlacementPointerDown(event, placement)}
                    style={{ cursor: placement.zone === garment.placementZone ? 'crosshair' : 'pointer' }}
                  />
                  {placement.zone === garment.placementZone ? <PlacementGrid placement={placement} /> : null}
                  {placement.placementLayers.map((layer) => {
                    const selected = placement.zone === garment.placementZone && state.selectedLayerIds.has(layer.id);
                    return (
                      <g
                        key={layer.id}
                        transform={`translate(${placement.zoneCenterX} ${placement.zoneCenterY}) scale(${placement.workspaceScale}) translate(${layer.x} ${layer.y}) rotate(${layer.rotationDeg}) scale(${layer.scale * (layer.flipX ? -1 : 1)} ${layer.scale * (layer.flipY ? -1 : 1)})`}
                        onPointerDown={(event) => handleLayerPointerDown(event, layer, placement)}
                        style={{ cursor: layer.locked ? 'not-allowed' : 'move', opacity: placement.zone === garment.placementZone ? 1 : 0.35 }}
                      >
                        <HtvLayerShape layer={layer} />
                        {selected ? <SelectionOutline layer={layer} workspaceScale={placement.workspaceScale} zoom={state.canvas.zoom} /> : null}
                      </g>
                    );
                  })}
                </g>
              ))}

              {singleSelectedLayer && activePlacement ? (
                <TransformHandles
                  layer={singleSelectedLayer}
                  placement={activePlacement}
                  zoom={state.canvas.zoom}
                  onScaleHandlePointerDown={handleScaleHandlePointerDown}
                  onRotateHandlePointerDown={handleRotateHandlePointerDown}
                />
              ) : null}

              {interaction?.kind === 'marquee' && activePlacement && interaction.placementZone === activePlacement.zone && interaction.moved ? (
                <rect
                  x={activePlacement.zoneCenterX + Math.min(interaction.startMmX, interaction.curMmX) * activePlacement.workspaceScale}
                  y={activePlacement.zoneCenterY + Math.min(interaction.startMmY, interaction.curMmY) * activePlacement.workspaceScale}
                  width={Math.abs(interaction.curMmX - interaction.startMmX) * activePlacement.workspaceScale}
                  height={Math.abs(interaction.curMmY - interaction.startMmY) * activePlacement.workspaceScale}
                  fill="rgba(139,92,246,0.16)"
                  stroke="#8b5cf6"
                  strokeWidth={1 / state.canvas.zoom}
                  pointerEvents="none"
                />
              ) : null}
            </svg>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--studio-ink-subtle)]">
          {garment.activePlacementZones.map((zone) => (
            <span key={zone} className={`rounded-full border px-2.5 py-1 ${zone === garment.placementZone ? 'border-violet-400/60 bg-violet-500/15 text-violet-100' : 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-muted)]'}`}>
              {zone}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex gap-1 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 p-1 shadow-sm backdrop-blur-sm lg:bottom-4 lg:right-4 lg:flex-col">
        <button onClick={zoomIn} className="rounded-md p-2 text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]" title="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={zoomOut} className="rounded-md p-2 text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]" title="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={resetView} className="rounded-md p-2 text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]" title="Reset view">
          <Scan className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute bottom-3 left-3 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-2 py-1 text-xs text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:left-4">
        {Math.round(state.canvas.zoom * 100)}%
      </div>
    </div>
  );
}

function SelectionOutline({ layer, workspaceScale, zoom }: { layer: HtvLayer; workspaceScale: number; zoom: number }) {
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
      strokeWidth={1.2 / Math.max(layer.scale * workspaceScale * zoom, 0.001)}
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
  placement,
  zoom,
  onScaleHandlePointerDown,
  onRotateHandlePointerDown,
}: {
  layer: HtvLayer;
  placement: PlacementProjection;
  zoom: number;
  onScaleHandlePointerDown: (event: React.PointerEvent<SVGRectElement>, layer: HtvLayer, placement: PlacementProjection, corner: { x: number; y: number }) => void;
  onRotateHandlePointerDown: (event: React.PointerEvent<SVGCircleElement>, layer: HtvLayer, placement: PlacementProjection) => void;
}) {
  const { width, height } = approximateLayerBounds(layer);
  const padding = Math.max(width, height) * 0.06 + 1.5;
  const hw = (width / 2 + padding) * layer.scale;
  const hh = (height / 2 + padding) * layer.scale;
  const theta = (layer.rotationDeg * Math.PI) / 180;
  const handleSize = 7 / Math.max(zoom, 0.2);
  const rotateOffset = 18 / Math.max(zoom, 0.2);

  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((point) => {
    const rotated = rotatePoint(point.x, point.y, theta);
    const mmPoint = { x: layer.x + rotated.x, y: layer.y + rotated.y };
    return {
      mmPoint,
      svgPoint: {
        x: placement.zoneCenterX + mmPoint.x * placement.workspaceScale,
        y: placement.zoneCenterY + mmPoint.y * placement.workspaceScale,
      },
    };
  });

  const rotateHandleLocal = rotatePoint(0, -hh - rotateOffset / placement.workspaceScale, theta);
  const rotateHandleMm = { x: layer.x + rotateHandleLocal.x, y: layer.y + rotateHandleLocal.y };
  const rotateHandle = {
    x: placement.zoneCenterX + rotateHandleMm.x * placement.workspaceScale,
    y: placement.zoneCenterY + rotateHandleMm.y * placement.workspaceScale,
  };
  const topCenterLocal = rotatePoint(0, -hh, theta);
  const topCenterMm = { x: layer.x + topCenterLocal.x, y: layer.y + topCenterLocal.y };
  const topCenter = {
    x: placement.zoneCenterX + topCenterMm.x * placement.workspaceScale,
    y: placement.zoneCenterY + topCenterMm.y * placement.workspaceScale,
  };

  return (
    <g pointerEvents="none">
      <line x1={topCenter.x} y1={topCenter.y} x2={rotateHandle.x} y2={rotateHandle.y} stroke="#7c4dff" strokeWidth={1 / Math.max(zoom, 0.2)} />
      {corners.map((corner, index) => (
        <rect
          key={index}
          x={corner.svgPoint.x - handleSize / 2}
          y={corner.svgPoint.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke="#7c4dff"
          strokeWidth={1.2 / Math.max(zoom, 0.2)}
          pointerEvents="all"
          style={{ cursor: index % 2 === 0 ? 'nwse-resize' : 'nesw-resize' }}
          onPointerDown={(event) => onScaleHandlePointerDown(event, layer, placement, corner.mmPoint)}
        />
      ))}
      <circle
        cx={rotateHandle.x}
        cy={rotateHandle.y}
        r={handleSize / 1.6}
        fill="#ffffff"
        stroke="#7c4dff"
        strokeWidth={1.2 / Math.max(zoom, 0.2)}
        pointerEvents="all"
        style={{ cursor: 'grab' }}
        onPointerDown={(event) => onRotateHandlePointerDown(event, layer, placement)}
      />
    </g>
  );
}

function PlacementGrid({ placement }: { placement: PlacementProjection }) {
  const xQuarter = placement.zoneBox.width / 4;
  const yQuarter = placement.zoneBox.height / 4;
  return (
    <g pointerEvents="none">
      {Array.from({ length: 3 }, (_, index) => (
        <line
          key={`v-${index}`}
          x1={placement.zoneBox.x + xQuarter * (index + 1)}
          y1={placement.zoneBox.y}
          x2={placement.zoneBox.x + xQuarter * (index + 1)}
          y2={placement.zoneBox.y + placement.zoneBox.height}
          stroke="rgba(255,255,255,0.12)"
          strokeDasharray="3 5"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 3 }, (_, index) => (
        <line
          key={`h-${index}`}
          x1={placement.zoneBox.x}
          y1={placement.zoneBox.y + yQuarter * (index + 1)}
          x2={placement.zoneBox.x + placement.zoneBox.width}
          y2={placement.zoneBox.y + yQuarter * (index + 1)}
          stroke="rgba(255,255,255,0.12)"
          strokeDasharray="3 5"
          strokeWidth="1"
        />
      ))}
      <line
        x1={placement.zoneCenterX}
        y1={placement.zoneBox.y}
        x2={placement.zoneCenterX}
        y2={placement.zoneBox.y + placement.zoneBox.height}
        stroke="rgba(124,77,255,0.7)"
        strokeDasharray="4 4"
        strokeWidth="1"
      />
      <line
        x1={placement.zoneBox.x}
        y1={placement.zoneCenterY}
        x2={placement.zoneBox.x + placement.zoneBox.width}
        y2={placement.zoneCenterY}
        stroke="rgba(124,77,255,0.7)"
        strokeDasharray="4 4"
        strokeWidth="1"
      />
    </g>
  );
}