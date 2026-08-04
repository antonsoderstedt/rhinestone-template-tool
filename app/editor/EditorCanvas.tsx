'use client';

import { Expand, Grid2X2, Minus, Plus, Scan } from 'lucide-react';
import { useRef, useMemo, useState, useEffect } from 'react';
import { getRecommendedCenterDistance, getStoneSizeProfile } from '@/src/lib/rhinestone-engine/index';
import { EditorAction, EditorState, EditableStone } from './EditorState';
import { calculateCanvasWorkspaceBounds, calculateDisplayedCanvasViewBox, screenToMm, snapToGrid, isPointNearStone, interpolateLinePointsAtSpacing, CanvasTransform } from './canvasCoordinates';
import { findNearestValidStonePosition, wouldCollide } from './collisionDetection';
import { isIgnoredKeyboardTarget } from './editorDomGuards';
import {
  applyBoxSelection,
  BOX_SELECTION_DRAG_THRESHOLD_PX,
  createSelectionBoxMm,
  hasExceededBoxSelectionThreshold,
  shouldStartBoxSelection,
} from './selectionBox';

interface EditorCanvasProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onNotify?: (message: string, tone: 'success' | 'warning' | 'error' | 'info') => void;
}

const RULER_BAND_PX = 44;
const RULER_STEP_MM = 10;
const RULER_LABEL_STEP_MM = 50;
const SELECTION_MEASURE_OFFSET_MM = 18;

function buildRulerTickValues(start: number, end: number): number[] {
  const first = Math.ceil(start / RULER_STEP_MM) * RULER_STEP_MM;
  const ticks: number[] = [];
  for (let value = first; value <= end; value += RULER_STEP_MM) {
    ticks.push(value);
  }
  return ticks;
}

function toPercent(value: number, start: number, span: number): string {
  if (span <= 0) return '0%';
  return `${((value - start) / span) * 100}%`;
}

function getStoneCanvasColor(stone: EditableStone): string {
  if (typeof stone.metadata?.fill === 'string') return stone.metadata.fill;
  if (typeof stone.metadata?.stroke === 'string') return stone.metadata.stroke;
  return '#7c3aed';
}

export default function EditorCanvas({ state, dispatch, onNotify }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const suppressNextClickRef = useRef(false);
  const nextStoneIdRef = useRef(0);
  
  // Hover state for manual tool
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoverSuggestedFrom, setHoverSuggestedFrom] = useState<{ x: number; y: number } | null>(null);
  const [hoverCollision, setHoverCollision] = useState<boolean>(false);
  const [recentPlacedStoneIds, setRecentPlacedStoneIds] = useState<Set<string>>(new Set());
  const [drawState, setDrawState] = useState<{
    pointerId: number;
    lastPlacedX: number;
    lastPlacedY: number;
    pendingStones: EditableStone[];
  } | null>(null);
  const [eraseState, setEraseState] = useState<{
    pointerId: number;
    lastX: number;
    lastY: number;
    pendingStoneIds: Set<string>;
  } | null>(null);
  
  // Drag state for select tool
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragStartX: number;
    dragStartY: number;
    currentDx?: number;
    currentDy?: number;
    originalPositions: Map<string, { x: number; y: number }>;
  } | null>(null);
  
  // Pan state
  const [panState, setPanState] = useState<{
    isPanning: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  
  // Box selection state
  const [boxSelection, setBoxSelection] = useState<{
    pointerId: number;
    startScreenX: number;
    startScreenY: number;
    startMmX: number;
    startMmY: number;
    currentMmX: number;
    currentMmY: number;
    shiftKey: boolean;
    hasExceededThreshold: boolean;
  } | null>(null);

  // Determine which stones to render
  const stones = useMemo(() => {
    if (state.editableTemplate.isEditable) {
      return state.editableTemplate.stones;
    }
    return state.template?.stones || [];
  }, [state.template, state.editableTemplate]);

  const selectedStones = useMemo(
    () => stones.filter((stone) => state.selectedStoneIds.has(stone.id)),
    [stones, state.selectedStoneIds],
  );

  const createStoneId = () => {
    nextStoneIdRef.current += 1;
    return `stone-${nextStoneIdRef.current}`;
  };

  const manualDrawSpacingMm = useMemo(
    () => getRecommendedCenterDistance(state.manualTool.addStoneSize),
    [state.manualTool.addStoneSize],
  );
  const manualAssistBrushRadiusMm = Math.max(state.manualTool.assistBrushSizeMm / 2, 1);

  const resolveManualPlacement = (rawX: number, rawY: number, extraStones: readonly EditableStone[] = []) => {
    let x = rawX;
    let y = rawY;

    if (state.manualTool.snapToGrid) {
      x = snapToGrid(x, state.manualTool.gridSnapSize);
      y = snapToGrid(y, state.manualTool.gridSnapSize);
    }

    const profile = getStoneSizeProfile(state.manualTool.addStoneSize);
    const radius = profile.recommendedHoleDiameterMm / 2;
    const collision = wouldCollide(x, y, radius, [...stones, ...extraStones]);

    return {
      x,
      y,
      radius,
      collides: collision.collides,
      desiredX: x,
      desiredY: y,
    };
  };

  const resolveSmartManualPlacement = (rawX: number, rawY: number, extraStones: readonly EditableStone[] = []) => {
    const candidate = resolveManualPlacement(rawX, rawY, extraStones);
    if (!candidate.collides) {
      return { ...candidate, nudged: false };
    }

    const corrected = findNearestValidStonePosition(candidate.x, candidate.y, candidate.radius, [...stones, ...extraStones], {
      snapToGrid: state.manualTool.snapToGrid,
      gridSizeMm: state.manualTool.gridSnapSize,
      searchStepMm: Math.max(candidate.radius, 1),
      maxRadiusMm: Math.max(manualDrawSpacingMm * 2, candidate.radius * 8),
    });

    if (!corrected) {
      return { ...candidate, nudged: false };
    }

    return {
      x: corrected.x,
      y: corrected.y,
      radius: candidate.radius,
      collides: false,
      nudged: corrected.x !== candidate.x || corrected.y !== candidate.y,
      desiredX: candidate.x,
      desiredY: candidate.y,
    };
  };

  const collectStoneIdsNearPoints = (points: readonly { x: number; y: number }[], existingIds: Set<string>, brushRadiusMm: number) => {
    const nextIds = new Set(existingIds);
    for (const point of points) {
      for (const stone of stones) {
        const distance = Math.hypot(point.x - stone.center.x, point.y - stone.center.y);
        if (distance <= brushRadiusMm + stone.holeDiameterMm / 2) {
          nextIds.add(stone.id);
        }
      }
    }
    return nextIds;
  };

  // Calculate canvas viewBox based on stones
  const workspaceBounds = useMemo(() => calculateCanvasWorkspaceBounds(stones), [stones]);
  const viewBox = useMemo(
    () => calculateDisplayedCanvasViewBox(workspaceBounds, state.canvas.zoom, state.canvas.panX, state.canvas.panY),
    [workspaceBounds, state.canvas.zoom, state.canvas.panX, state.canvas.panY],
  );

  const selectionBounds = useMemo(() => {
    if (selectedStones.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stone of selectedStones) {
      const radius = stone.holeDiameterMm / 2;
      minX = Math.min(minX, stone.center.x - radius);
      minY = Math.min(minY, stone.center.y - radius);
      maxX = Math.max(maxX, stone.center.x + radius);
      maxY = Math.max(maxY, stone.center.y + radius);
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedStones]);

  // Handle zoom controls
  const handleZoomIn = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.min(state.canvas.zoom * 1.2, 5) } });
  };

  const handleZoomOut = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.max(state.canvas.zoom / 1.2, 0.1) } });
  };

  const handleZoomReset = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });
  };

  const handleFitToScreen = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });
  };

  const toggleGrid = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { showGrid: !state.canvas.showGrid } });
  };

  // Get canvas transform for coordinate conversion
  const getCanvasTransform = (): CanvasTransform | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    
    const rect = svg.getBoundingClientRect();
    return {
      viewBoxX: viewBox.x,
      viewBoxY: viewBox.y,
      viewBoxWidth: viewBox.width,
      viewBoxHeight: viewBox.height,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
  };

  // Handle canvas mouse move (hover preview for manual tool)
  const handleMouseMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // Pan mode
    if (panState) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = e.clientX - panState.startX;
      const dy = e.clientY - panState.startY;
      const mmPerPxX = viewBox.width / Math.max(rect.width, 1);
      const mmPerPxY = viewBox.height / Math.max(rect.height, 1);
      dispatch({ 
        type: 'UPDATE_CANVAS', 
        updates: { 
          panX: panState.startPanX + dx * mmPerPxX, 
          panY: panState.startPanY + dy * mmPerPxY,
        } 
      });
      return;
    }

    if (drawState) {
      const svg = svgRef.current;
      const transform = getCanvasTransform();
      if (!svg || !transform) return;

      const currentPos = screenToMm(e.clientX, e.clientY, svg, transform);
      const resolvedCurrent = resolveSmartManualPlacement(currentPos.x, currentPos.y, drawState.pendingStones);
      setHoverPosition({ x: resolvedCurrent.x, y: resolvedCurrent.y });
      setHoverSuggestedFrom(resolvedCurrent.nudged ? { x: resolvedCurrent.desiredX, y: resolvedCurrent.desiredY } : null);
      setHoverCollision(resolvedCurrent.collides);

      const sampledPoints = interpolateLinePointsAtSpacing(
        drawState.lastPlacedX,
        drawState.lastPlacedY,
        resolvedCurrent.x,
        resolvedCurrent.y,
        manualDrawSpacingMm,
      );

      if (sampledPoints.length === 0) {
        return;
      }

      let lastPlacedX = drawState.lastPlacedX;
      let lastPlacedY = drawState.lastPlacedY;
      const pendingStones = [...drawState.pendingStones];
      for (const point of sampledPoints) {
        const candidate = resolveSmartManualPlacement(point.x, point.y, pendingStones);
        const duplicate = pendingStones.some((stone) => stone.center.x === candidate.x && stone.center.y === candidate.y);
        if (candidate.collides || duplicate) {
          continue;
        }
        pendingStones.push({
          id: createStoneId(),
          center: { x: candidate.x, y: candidate.y },
          holeDiameterMm: candidate.radius * 2,
          stoneSize: state.manualTool.addStoneSize,
        });
        lastPlacedX = candidate.x;
        lastPlacedY = candidate.y;
      }

      setDrawState({
        ...drawState,
        lastPlacedX,
        lastPlacedY,
        pendingStones,
      });
      return;
    }

    if (eraseState) {
      const svg = svgRef.current;
      const transform = getCanvasTransform();
      if (!svg || !transform) return;

      const currentPos = screenToMm(e.clientX, e.clientY, svg, transform);
      const resolvedCurrent = resolveManualPlacement(currentPos.x, currentPos.y);
      setHoverPosition({ x: resolvedCurrent.x, y: resolvedCurrent.y });
      setHoverSuggestedFrom(null);
      setHoverCollision(false);

      const sampledPoints = [
        { x: resolvedCurrent.x, y: resolvedCurrent.y },
        ...interpolateLinePointsAtSpacing(
          eraseState.lastX,
          eraseState.lastY,
          resolvedCurrent.x,
          resolvedCurrent.y,
          Math.max(manualDrawSpacingMm / 2, 1),
        ),
      ];

      setEraseState({
        pointerId: eraseState.pointerId,
        lastX: resolvedCurrent.x,
        lastY: resolvedCurrent.y,
        pendingStoneIds: collectStoneIdsNearPoints(sampledPoints, eraseState.pendingStoneIds, manualAssistBrushRadiusMm),
      });
      return;
    }

    if (boxSelection) {
      const svg = svgRef.current;
      const transform = getCanvasTransform();
      if (!svg || !transform) return;

      const currentPos = screenToMm(e.clientX, e.clientY, svg, transform);
      setBoxSelection({
        ...boxSelection,
        currentMmX: currentPos.x,
        currentMmY: currentPos.y,
        hasExceededThreshold:
          boxSelection.hasExceededThreshold ||
          hasExceededBoxSelectionThreshold(
            e.clientX - boxSelection.startScreenX,
            e.clientY - boxSelection.startScreenY,
            BOX_SELECTION_DRAG_THRESHOLD_PX,
          ),
      });
      return;
    }
    
    if (state.activeTool === 'manual') {
      const svg = svgRef.current;
      const transform = getCanvasTransform();
      if (!svg || !transform) return;

      const pos = screenToMm(e.clientX, e.clientY, svg, transform);
      const resolved = state.manualTool.interactionMode === 'place'
        ? resolveSmartManualPlacement(pos.x, pos.y)
        : resolveManualPlacement(pos.x, pos.y);

      setHoverPosition({ x: resolved.x, y: resolved.y });
      setHoverSuggestedFrom(state.manualTool.interactionMode === 'place' && 'nudged' in resolved && resolved.nudged ? { x: resolved.desiredX, y: resolved.desiredY } : null);
      setHoverCollision(state.manualTool.interactionMode === 'place' ? resolved.collides : false);
    } else if (state.activeTool === 'select' && dragState?.isDragging) {
      // Handle dragging - update drag state but don't dispatch until mouseUp
      const svg = svgRef.current;
      const transform = getCanvasTransform();
      if (!svg || !transform) return;

      const currentPos = screenToMm(e.clientX, e.clientY, svg, transform);
      const dx = currentPos.x - dragState.dragStartX;
      const dy = currentPos.y - dragState.dragStartY;

      // Update drag state with current delta
      setDragState({
        ...dragState,
        currentDx: dx,
        currentDy: dy,
      });
    } else {
      setHoverPosition(null);
      setHoverCollision(false);
    }
  };

  const handleMouseLeave = () => {
    if (boxSelection || drawState || eraseState) return;
    setHoverPosition(null);
    setHoverSuggestedFrom(null);
    setHoverCollision(false);
  };

  useEffect(() => {
    if (recentPlacedStoneIds.size === 0) return;
    const timeoutId = window.setTimeout(() => setRecentPlacedStoneIds(new Set()), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [recentPlacedStoneIds]);

  // Handle canvas click
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    // Don't handle clicks during pan
    if (panState) return;
    
    const svg = svgRef.current;
    const transform = getCanvasTransform();
    if (!svg || !transform) return;

    const clickPos = screenToMm(e.clientX, e.clientY, svg, transform);

    if (state.activeTool === 'manual') {
      if (state.manualTool.interactionMode === 'place') {
        const candidate = resolveSmartManualPlacement(clickPos.x, clickPos.y);
        if (candidate.collides) {
          onNotify?.('Placement blocked by collision.', 'warning');
        } else if (candidate.nudged) {
          onNotify?.('Stone snapped to the nearest safe position.', 'info');
        }
      }
    } else if (state.activeTool === 'select') {
      // Find stone near click
      const clickedStone = stones.find(stone => {
        const stoneX = stone.center.x;
        const stoneY = stone.center.y;
        return isPointNearStone(clickPos.x, clickPos.y, stoneX, stoneY, stone.holeDiameterMm / 2);
      });

      if (clickedStone) {
        // Convert to editable if needed
        if (!state.editableTemplate.isEditable) {
          dispatch({ type: 'CONVERT_TO_EDITABLE' });
        }

        // Toggle selection (with shift for multi-select)
        const newSelection = new Set(state.selectedStoneIds);
        if (e.shiftKey) {
          if (newSelection.has(clickedStone.id)) {
            newSelection.delete(clickedStone.id);
          } else {
            newSelection.add(clickedStone.id);
          }
        } else {
          newSelection.clear();
          newSelection.add(clickedStone.id);
        }
        
        dispatch({ type: 'SET_SELECTED_STONES', ids: newSelection });
      } else if (!e.shiftKey) {
        // Clicked empty space, clear selection
        dispatch({ type: 'SET_SELECTED_STONES', ids: new Set() });
      }
    }
  };

  // Handle mouse down on stone (for dragging)
  const handleStoneMouseDown = (e: React.PointerEvent<SVGCircleElement>, stoneId: string) => {
    // Don't handle if panning
    if (spacePressed || e.button === 1) return;
    
    if (state.activeTool !== 'select') return;
    if (!state.editableTemplate.isEditable) {
      dispatch({ type: 'CONVERT_TO_EDITABLE' });
      return;
    }

    e.stopPropagation();

    // If clicking on an unselected stone, select it
    if (!state.selectedStoneIds.has(stoneId)) {
      const newSelection = e.shiftKey ? new Set(state.selectedStoneIds) : new Set<string>();
      newSelection.add(stoneId);
      dispatch({ type: 'SET_SELECTED_STONES', ids: newSelection });
    }

    // Start drag
    const svg = svgRef.current;
    const transform = getCanvasTransform();
    if (!svg || !transform) return;

    const startPos = screenToMm(e.clientX, e.clientY, svg, transform);
    
    const originalPositions = new Map<string, { x: number; y: number }>();
    for (const id of state.selectedStoneIds) {
      const stone = stones.find(s => s.id === id);
      if (stone) {
        originalPositions.set(id, { x: stone.center.x, y: stone.center.y });
      }
    }

    setDragState({
      isDragging: true,
      dragStartX: startPos.x,
      dragStartY: startPos.y,
      originalPositions,
    });
  };

  const handleMouseUp = () => {
    if (drawState) {
      if (svgRef.current?.hasPointerCapture(drawState.pointerId)) {
        svgRef.current.releasePointerCapture(drawState.pointerId);
      }
      if (drawState.pendingStones.length > 0) {
        if (!state.editableTemplate.isEditable) {
          dispatch({ type: 'CONVERT_TO_EDITABLE' });
        }
        dispatch({ type: 'ADD_STONES', stones: drawState.pendingStones });
        const newIds = new Set(drawState.pendingStones.map((stone) => stone.id));
        dispatch({ type: 'SET_SELECTED_STONES', ids: newIds });
        setRecentPlacedStoneIds(newIds);
        onNotify?.(
          drawState.pendingStones.length === 1
            ? 'Stone added.'
            : `${drawState.pendingStones.length} stones drawn.`,
          'success',
        );
      }
      suppressNextClickRef.current = true;
      setDrawState(null);
      setHoverPosition(null);
      setHoverSuggestedFrom(null);
      setHoverCollision(false);
      return;
    }

    if (eraseState) {
      if (svgRef.current?.hasPointerCapture(eraseState.pointerId)) {
        svgRef.current.releasePointerCapture(eraseState.pointerId);
      }
      const pendingStoneIds = [...eraseState.pendingStoneIds];
      if (pendingStoneIds.length > 0) {
        if (!state.editableTemplate.isEditable) {
          dispatch({ type: 'CONVERT_TO_EDITABLE' });
        }
        dispatch({ type: 'DELETE_STONES', stoneIds: pendingStoneIds });
        onNotify?.(
          pendingStoneIds.length === 1 ? 'Stone erased.' : `${pendingStoneIds.length} stones erased.`,
          'success',
        );
      }
      suppressNextClickRef.current = true;
      setEraseState(null);
      setHoverPosition(null);
      setHoverSuggestedFrom(null);
      setHoverCollision(false);
      return;
    }

    if (boxSelection) {
      if (boxSelection.hasExceededThreshold) {
        dispatch({
          type: 'SET_SELECTED_STONES',
          ids: applyBoxSelection(
            stones,
            { x: boxSelection.startMmX, y: boxSelection.startMmY },
            { x: boxSelection.currentMmX, y: boxSelection.currentMmY },
            state.selectedStoneIds,
            boxSelection.shiftKey,
          ),
        });
        suppressNextClickRef.current = true;
      }

      if (svgRef.current?.hasPointerCapture(boxSelection.pointerId)) {
        svgRef.current.releasePointerCapture(boxSelection.pointerId);
      }
      setBoxSelection(null);
      return;
    }

    // If we were dragging, dispatch final move
    if (dragState?.isDragging && dragState.currentDx !== undefined && dragState.currentDy !== undefined) {
      const dx = dragState.currentDx;
      const dy = dragState.currentDy;
      
      const moves = Array.from(state.selectedStoneIds).map(id => {
        const original = dragState.originalPositions.get(id);
        if (!original) return null;
        
        let newX = original.x + dx;
        let newY = original.y + dy;
        
        // Apply snapping if enabled
        if (state.manualTool.snapToGrid) {
          newX = snapToGrid(newX, state.manualTool.gridSnapSize);
          newY = snapToGrid(newY, state.manualTool.gridSnapSize);
        }
        
        return { id, toX: newX, toY: newY };
      }).filter((m): m is { id: string; toX: number; toY: number } => m !== null);

      if (moves.length > 0) {
        dispatch({ type: 'MOVE_STONES', moves });
      }
    }
    
    setDragState(null);
    setPanState(null);
  };

  // Handle mouse down on SVG (for pan)
  const handleSvgMouseDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Space + left click or middle mouse button = pan
    if (spacePressed || e.button === 1) {
      e.preventDefault();
      setPanState({
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: state.canvas.panX,
        startPanY: state.canvas.panY,
      });
      return;
    }

    const svg = svgRef.current;
    const transform = getCanvasTransform();
    if (!svg || !transform) return;

    const startPos = screenToMm(e.clientX, e.clientY, svg, transform);

    if (state.activeTool === 'manual' && e.button === 0) {
      const candidate = state.manualTool.interactionMode === 'place'
        ? resolveSmartManualPlacement(startPos.x, startPos.y)
        : resolveManualPlacement(startPos.x, startPos.y);
      svg.setPointerCapture(e.pointerId);

      if (state.manualTool.interactionMode === 'erase') {
        setEraseState({
          pointerId: e.pointerId,
          lastX: candidate.x,
          lastY: candidate.y,
          pendingStoneIds: collectStoneIdsNearPoints([{ x: candidate.x, y: candidate.y }], new Set<string>(), manualAssistBrushRadiusMm),
        });
        setHoverPosition({ x: candidate.x, y: candidate.y });
        setHoverCollision(false);
      } else {
        const pendingStones: EditableStone[] = candidate.collides
          ? []
          : [{
              id: createStoneId(),
              center: { x: candidate.x, y: candidate.y },
              holeDiameterMm: candidate.radius * 2,
              stoneSize: state.manualTool.addStoneSize,
            }];

        setDrawState({
          pointerId: e.pointerId,
          lastPlacedX: candidate.x,
          lastPlacedY: candidate.y,
          pendingStones,
        });
        setHoverPosition({ x: candidate.x, y: candidate.y });
        setHoverCollision(candidate.collides);
      }
      suppressNextClickRef.current = true;
      return;
    }

    const clickedStone = stones.find((stone) =>
      isPointNearStone(startPos.x, startPos.y, stone.center.x, stone.center.y, stone.holeDiameterMm / 2),
    );

    if (!shouldStartBoxSelection({
      activeTool: state.activeTool,
      button: e.button,
      spacePressed,
      clickedStone: Boolean(clickedStone),
      draggingStone: Boolean(dragState?.isDragging),
    })) {
      return;
    }

    svg.setPointerCapture(e.pointerId);
    setBoxSelection({
      pointerId: e.pointerId,
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startMmX: startPos.x,
      startMmY: startPos.y,
      currentMmX: startPos.x,
      currentMmY: startPos.y,
      shiftKey: e.shiftKey,
      hasExceededThreshold: false,
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isIgnoredKeyboardTarget(e.target)) return;
      
      // Delete/Backspace: delete selected stones
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedStoneIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'DELETE_STONES', stoneIds: Array.from(state.selectedStoneIds) });
      }
      
      // Escape: cancel box selection before clearing selection
      if (e.key === 'Escape' && boxSelection) {
        e.preventDefault();
        if (svgRef.current?.hasPointerCapture(boxSelection.pointerId)) {
          svgRef.current.releasePointerCapture(boxSelection.pointerId);
        }
        setBoxSelection(null);
        return;
      }

      // Escape: clear selection
      if (e.key === 'Escape' && state.selectedStoneIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'SET_SELECTED_STONES', ids: new Set() });
      }
      
      // Cmd/Ctrl+D: duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && state.selectedStoneIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'DUPLICATE_STONES', stoneIds: Array.from(state.selectedStoneIds) });
      }
      
      // Cmd/Ctrl+C: copy
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && state.selectedStoneIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'COPY_STONES', stoneIds: Array.from(state.selectedStoneIds) });
      }

      // Cmd/Ctrl+A: select all editable stones
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && state.editableTemplate.isEditable) {
        e.preventDefault();
        dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(state.editableTemplate.stones.map((stone) => stone.id)) });
      }
      
      // Cmd/Ctrl+V: paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        dispatch({ type: 'PASTE_STONES' });
      }
      
      // Cmd/Ctrl+Z: undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      
      // Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo
      if (((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boxSelection, state.selectedStoneIds, dispatch]);

  // Mouse wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1; // zoom in/out
      const newZoom = Math.min(Math.max(state.canvas.zoom * delta, 0.1), 5);
      
      dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: newZoom } });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [state.canvas.zoom, dispatch]);

  // Space key pan state
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !spacePressed) {
        if (!isIgnoredKeyboardTarget(e.target)) {
          e.preventDefault();
          setSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed]);

  return (
    <div ref={containerRef} className="flex-1 bg-zinc-800 relative overflow-hidden">
      {/* Canvas Controls */}
      <div className="absolute left-4 top-4 z-10 rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-300 shadow-lg backdrop-blur-sm">
        <div className="font-medium text-zinc-100">Canvas guide</div>
        <div className="mt-1 text-zinc-500">
          {state.activeTool === 'manual'
            ? state.manualTool.interactionMode === 'erase'
              ? 'Click or drag to erase stones directly on the canvas.'
                : `Click or drag to place stones at ${manualDrawSpacingMm.toFixed(1)} mm spacing. The smart preview shows when a stone will be nudged.`
            : 'Use the tool controls, then pan and inspect the result here. Cmd/Ctrl+A selects the whole editable design so you can drag it together.'}
        </div>
        {hoverPosition && state.activeTool === 'manual' && (
          <div className="mt-2 font-mono text-[11px] text-zinc-400">
            X {hoverPosition.x.toFixed(1)} mm · Y {hoverPosition.y.toFixed(1)} mm
          </div>
        )}
        {hoverSuggestedFrom && state.activeTool === 'manual' && state.manualTool.interactionMode === 'place' && (
          <div className="mt-1 text-[11px] text-amber-300">
            Smart assist is nudging this stone to a safer spot.
          </div>
        )}
      </div>

      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 shadow-lg backdrop-blur-sm">
        <button
          onClick={handleZoomIn}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomReset}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          title="Reset zoom to 100%"
          aria-label="Reset zoom"
        >
          <Scan className="h-4 w-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          title="Fit the design to the current canvas view"
          aria-label="Fit to screen"
        >
          <Expand className="h-4 w-4" />
        </button>
        <div className="my-1 h-px bg-zinc-800" />
        <button
          onClick={toggleGrid}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition ${
            state.canvas.showGrid
              ? 'bg-purple-600 text-white'
              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
          }`}
          title={state.canvas.showGrid ? 'Hide grid overlay' : 'Show grid overlay'}
          aria-label="Toggle grid"
        >
          <Grid2X2 className="h-4 w-4" />
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="w-full h-full p-8">
        <div className="relative h-full w-full rounded-xl border border-zinc-700 bg-zinc-900/30 p-3">
          {state.canvas.showRulers && (
            <>
              <div className="absolute left-0 top-0 z-10 h-11 w-11 rounded-tl-xl border-b border-r border-zinc-500 bg-slate-300" />
              <div className="absolute left-11 right-0 top-0 z-10 h-11 overflow-hidden rounded-tr-xl border-b border-zinc-500 bg-slate-200">
                {buildRulerTickValues(viewBox.x, viewBox.x + viewBox.width).map((tick) => (
                  <div
                    key={`overlay-top-${tick}`}
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: toPercent(tick, viewBox.x, viewBox.width) }}
                  >
                    <div className={`w-px bg-slate-700 ${tick % RULER_LABEL_STEP_MM === 0 ? 'h-11' : 'h-6'} `} />
                    {tick % RULER_LABEL_STEP_MM === 0 && (
                      <span className="absolute left-1 top-1 text-[11px] font-semibold leading-none text-slate-900">
                        {Math.round(tick)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 top-11 z-10 w-11 overflow-hidden rounded-bl-xl border-r border-zinc-500 bg-slate-200">
                {buildRulerTickValues(viewBox.y, viewBox.y + viewBox.height).map((tick) => (
                  <div
                    key={`overlay-left-${tick}`}
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: toPercent(tick, viewBox.y, viewBox.height) }}
                  >
                    <div className={`h-px bg-slate-700 ${tick % RULER_LABEL_STEP_MM === 0 ? 'w-11' : 'w-6'} `} />
                    {tick % RULER_LABEL_STEP_MM === 0 && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[11px] font-semibold leading-none text-slate-900">
                        {Math.round(tick)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div
            className="relative h-full w-full"
            style={{
              paddingTop: state.canvas.showRulers ? `${RULER_BAND_PX}px` : 0,
              paddingLeft: state.canvas.showRulers ? `${RULER_BAND_PX}px` : 0,
            }}
          >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="border border-zinc-600 bg-white h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            cursor: spacePressed || panState ? 'grab' :
                    state.activeTool === 'manual' ? (hoverCollision ? 'not-allowed' : 'crosshair') :
                    state.activeTool === 'select' ? 'default' :
                    'default',
          }}
          onClick={handleSvgClick}
          onPointerDown={handleSvgMouseDown}
          onPointerMove={handleMouseMove}
          onPointerLeave={handleMouseLeave}
          onPointerUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Grid */}
          {state.canvas.showGrid && (
            <defs>
              <pattern
                id="grid-minor"
                width={state.canvas.gridSizeMm}
                height={state.canvas.gridSizeMm}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${state.canvas.gridSizeMm} 0 L 0 0 0 ${state.canvas.gridSizeMm}`}
                  fill="none"
                  stroke="#d4d4d8"
                  strokeWidth="0.45"
                />
              </pattern>
              <pattern
                id="grid-major"
                width={state.canvas.gridSizeMm * 5}
                height={state.canvas.gridSizeMm * 5}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${state.canvas.gridSizeMm * 5} 0 L 0 0 0 ${state.canvas.gridSizeMm * 5}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="0.9"
                />
              </pattern>
            </defs>
          )}
          {state.canvas.showGrid && (
            <>
              <rect width="100%" height="100%" fill="url(#grid-minor)" />
              <rect width="100%" height="100%" fill="url(#grid-major)" opacity="0.95" />
            </>
          )}

          {/* Stones */}
          {stones.map((stone) => {
            const isSelected = state.selectedStoneIds.has(stone.id);
            const isPendingErase = eraseState?.pendingStoneIds.has(stone.id) ?? false;
            const isRecentlyPlaced = recentPlacedStoneIds.has(stone.id);
            
            // Calculate display position (apply drag offset if dragging)
            let displayX = stone.center.x;
            let displayY = stone.center.y;
            
            if (dragState?.isDragging && isSelected && dragState.currentDx !== undefined && dragState.currentDy !== undefined) {
              displayX += dragState.currentDx;
              displayY += dragState.currentDy;
              
              // Apply snapping if enabled
              if (state.manualTool.snapToGrid) {
                displayX = snapToGrid(displayX, state.manualTool.gridSnapSize);
                displayY = snapToGrid(displayY, state.manualTool.gridSnapSize);
              }
            }
            
            const r = stone.holeDiameterMm / 2;
            const baseColor = getStoneCanvasColor(stone);
            
            return (
              <g key={stone.id}>
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={displayX}
                    cy={displayY}
                    r={r + 0.9}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="0.8"
                    strokeDasharray="1 1"
                  />
                )}
                {isRecentlyPlaced && !isSelected && (
                  <circle
                    cx={displayX}
                    cy={displayY}
                    r={r + 1.4}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="0.9"
                    strokeDasharray="1.5 1.5"
                    opacity="0.95"
                  />
                )}
                
                {/* Stone hole */}
                <circle
                  cx={displayX}
                  cy={displayY}
                  r={r}
                  fill={isPendingErase ? 'rgba(239,68,68,0.18)' : baseColor}
                  fillOpacity={isPendingErase ? 0.18 : isSelected ? 0.42 : isRecentlyPlaced ? 0.56 : 0.36}
                  stroke={
                    isPendingErase
                      ? '#ef4444'
                      : baseColor
                  }
                  strokeWidth={isPendingErase ? '0.65' : isSelected ? '0.95' : isRecentlyPlaced ? '1' : '0.72'}
                  strokeDasharray={isPendingErase ? '1.2 1.2' : undefined}
                  className={state.activeTool === 'select' ? 'cursor-pointer hover:fill-purple-100 transition' : ''}
                  onPointerDown={(e) => handleStoneMouseDown(e, stone.id)}
                />
              </g>
            );
          })}

          {selectionBounds && (
            <g pointerEvents="none">
              <rect
                x={selectionBounds.minX}
                y={selectionBounds.minY}
                width={selectionBounds.width}
                height={selectionBounds.height}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="0.25"
                strokeDasharray="2 2"
                opacity="0.7"
              />

              <line
                x1={selectionBounds.minX}
                y1={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM}
                x2={selectionBounds.maxX}
                y2={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM}
                stroke="#0ea5e9"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.minX}
                y1={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM + 3}
                x2={selectionBounds.minX}
                y2={selectionBounds.minY}
                stroke="#0ea5e9"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.maxX}
                y1={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM + 3}
                x2={selectionBounds.maxX}
                y2={selectionBounds.minY}
                stroke="#0ea5e9"
                strokeWidth="0.25"
              />
              <text
                x={(selectionBounds.minX + selectionBounds.maxX) / 2}
                y={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM - 2}
                textAnchor="middle"
                fontSize="6"
                fill="#0369a1"
              >
                {selectionBounds.width.toFixed(1)} mm
              </text>

              <line
                x1={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM}
                y1={selectionBounds.minY}
                x2={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM}
                y2={selectionBounds.maxY}
                stroke="#0ea5e9"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM + 3}
                y1={selectionBounds.minY}
                x2={selectionBounds.minX}
                y2={selectionBounds.minY}
                stroke="#0ea5e9"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM + 3}
                y1={selectionBounds.maxY}
                x2={selectionBounds.minX}
                y2={selectionBounds.maxY}
                stroke="#0ea5e9"
                strokeWidth="0.25"
              />
              <text
                x={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM - 2}
                y={(selectionBounds.minY + selectionBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="6"
                fill="#0369a1"
                transform={`rotate(-90 ${selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM - 2} ${(selectionBounds.minY + selectionBounds.maxY) / 2})`}
              >
                {selectionBounds.height.toFixed(1)} mm
              </text>
            </g>
          )}

          {drawState?.pendingStones.map((stone) => (
            <circle
              key={stone.id}
              cx={stone.center.x}
              cy={stone.center.y}
              r={stone.holeDiameterMm / 2}
              fill="#fb923c"
              fillOpacity="0.2"
              stroke="#f97316"
              strokeWidth="0.6"
              strokeDasharray="1.2 1.2"
              opacity="0.95"
            />
          ))}

          {boxSelection?.hasExceededThreshold && (
            (() => {
              const box = createSelectionBoxMm(
                { x: boxSelection.startMmX, y: boxSelection.startMmY },
                { x: boxSelection.currentMmX, y: boxSelection.currentMmY },
              );
              return (
                <rect
                  x={box.left}
                  y={box.top}
                  width={box.right - box.left}
                  height={box.bottom - box.top}
                  fill="#3b82f620"
                  stroke="#3b82f6"
                  strokeWidth="0.4"
                  strokeDasharray="2 2"
                  pointerEvents="none"
                />
              );
            })()
          )}

          {/* Hover preview for manual tool */}
          {hoverPosition && state.activeTool === 'manual' && (
            <g pointerEvents="none">
                {hoverSuggestedFrom && state.manualTool.interactionMode === 'place' && (
                  <>
                    <line x1={hoverSuggestedFrom.x} y1={hoverSuggestedFrom.y} x2={hoverPosition.x} y2={hoverPosition.y} stroke="#f59e0b" strokeWidth="0.25" strokeDasharray="1.5 1.5" opacity="0.7" />
                    <circle
                      cx={hoverSuggestedFrom.x}
                      cy={hoverSuggestedFrom.y}
                      r={getStoneSizeProfile(state.manualTool.addStoneSize).recommendedHoleDiameterMm / 2}
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="0.25"
                      strokeDasharray="1 1"
                      opacity="0.7"
                    />
                  </>
                )}
              <line x1={viewBox.x} y1={hoverPosition.y} x2={viewBox.x + viewBox.width} y2={hoverPosition.y} stroke={state.manualTool.interactionMode === 'erase' ? '#f87171' : '#c084fc'} strokeWidth="0.15" strokeDasharray="1.5 1.5" opacity="0.45" />
              <line x1={hoverPosition.x} y1={viewBox.y} x2={hoverPosition.x} y2={viewBox.y + viewBox.height} stroke={state.manualTool.interactionMode === 'erase' ? '#f87171' : '#c084fc'} strokeWidth="0.15" strokeDasharray="1.5 1.5" opacity="0.45" />
              <circle
                cx={hoverPosition.x}
                cy={hoverPosition.y}
                  r={state.manualTool.interactionMode === 'erase' ? manualAssistBrushRadiusMm : getStoneSizeProfile(state.manualTool.addStoneSize).recommendedHoleDiameterMm / 2}
                fill={state.manualTool.interactionMode === 'erase' ? '#ef4444' : '#a855f7'}
                fillOpacity={state.manualTool.interactionMode === 'erase' ? 0.08 : 0.12}
                stroke={state.manualTool.interactionMode === 'erase' ? '#ef4444' : hoverCollision ? '#ef4444' : '#9333ea'}
                strokeWidth="0.45"
                strokeDasharray="2 2"
                opacity="0.65"
              />
            </g>
          )}

          {/* Empty State */}
          {stones.length === 0 && (
            <g>
              <text
                x={viewBox.x + viewBox.width / 2}
                y={viewBox.y + viewBox.height / 2 - 20}
                textAnchor="middle"
                className="fill-zinc-400 text-sm"
                style={{ fontSize: '14px' }}
              >
                Choose a tool to start designing
              </text>
              <text
                x={viewBox.x + viewBox.width / 2}
                y={viewBox.y + viewBox.height / 2}
                textAnchor="middle"
                className="fill-zinc-300 text-xs"
                style={{ fontSize: '11px' }}
              >
                Select Text, SVG, Grid, or Manual from the toolbar
              </text>
            </g>
          )}
        </svg>
          </div>
        </div>
      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-4 right-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
        {Math.round(state.canvas.zoom * 100)}%
      </div>
      
      {/* Manual Tool Status */}
      {state.activeTool === 'manual' && (
        <div className="absolute bottom-4 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-300">
          <div>Click to place {state.manualTool.addStoneSize} stone</div>
          {state.manualTool.snapToGrid && (
            <div className="text-zinc-400 mt-1">Snap: {state.manualTool.gridSnapSize}mm grid</div>
          )}
        </div>
      )}
      
      {/* Select Tool Status */}
      {state.activeTool === 'select' && state.selectedStoneIds.size > 0 && (
        <div className="absolute bottom-4 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-300">
          {state.selectedStoneIds.size} stone{state.selectedStoneIds.size > 1 ? 's' : ''} selected
          <div className="text-zinc-400 mt-1">Delete or drag to move</div>
        </div>
      )}
    </div>
  );
}
