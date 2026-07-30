'use client';

import { Expand, Grid2X2, Minus, Plus, Scan } from 'lucide-react';
import { useRef, useMemo, useState, useEffect } from 'react';
import { getStoneSizeProfile } from '@/src/lib/rhinestone-engine/index';
import { EditorAction, EditorState, EditableStone } from './EditorState';
import { screenToMm, snapToGrid, isPointNearStone, CanvasTransform } from './canvasCoordinates';
import { wouldCollide } from './collisionDetection';
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

export default function EditorCanvas({ state, dispatch, onNotify }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const suppressNextClickRef = useRef(false);
  const nextStoneIdRef = useRef(0);
  
  // Hover state for manual tool
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoverCollision, setHoverCollision] = useState<boolean>(false);
  
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

  const createStoneId = () => {
    nextStoneIdRef.current += 1;
    return `stone-${nextStoneIdRef.current}`;
  };

  // Calculate canvas viewBox based on stones
  const viewBox = useMemo(() => {
    if (stones.length === 0) {
      return { x: 0, y: 0, width: 400, height: 300 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stone of stones) {
      const x = stone.center.x;
      const y = stone.center.y;
      const r = stone.holeDiameterMm / 2;
      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
    }

    const padding = 20; // mm
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [stones]);

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
    const container = containerRef.current;
    if (!container || stones.length === 0) {
      handleZoomReset();
      return;
    }
    
    // Calculate available space
    const containerRect = container.getBoundingClientRect();
    const availableWidth = containerRect.width - 100; // padding
    const availableHeight = containerRect.height - 100;
    
    // Calculate zoom to fit
    const scaleX = availableWidth / viewBox.width;
    const scaleY = availableHeight / viewBox.height;
    const zoom = Math.min(scaleX, scaleY, 5); // max 5x zoom
    
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom, panX: 0, panY: 0 } });
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
      const dx = e.clientX - panState.startX;
      const dy = e.clientY - panState.startY;
      dispatch({ 
        type: 'UPDATE_CANVAS', 
        updates: { 
          panX: panState.startPanX + dx, 
          panY: panState.startPanY + dy 
        } 
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
      
      // Apply snapping if enabled
      if (state.manualTool.snapToGrid) {
        pos.x = snapToGrid(pos.x, state.manualTool.gridSnapSize);
        pos.y = snapToGrid(pos.y, state.manualTool.gridSnapSize);
      }
      
      // Check for collision
      const profile = getStoneSizeProfile(state.manualTool.addStoneSize);
      const radius = profile.recommendedHoleDiameterMm / 2;
      const collision = wouldCollide(pos.x, pos.y, radius, stones);
      
      setHoverPosition(pos);
      setHoverCollision(collision.collides);
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
    if (boxSelection) return;
    setHoverPosition(null);
    setHoverCollision(false);
  };

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
      // Place a stone
      let x = clickPos.x;
      let y = clickPos.y;
      
      if (state.manualTool.snapToGrid) {
        x = snapToGrid(x, state.manualTool.gridSnapSize);
        y = snapToGrid(y, state.manualTool.gridSnapSize);
      }

      const profile = getStoneSizeProfile(state.manualTool.addStoneSize);
      const radius = profile.recommendedHoleDiameterMm / 2;
      
      // Check for collision
      const collision = wouldCollide(x, y, radius, stones);
      if (collision.collides) {
        // Don't place stone - collision detected
        onNotify?.('Placement blocked by collision.', 'warning');
        return;
      }
      
      const newStone: EditableStone = {
        id: createStoneId(),
        center: { x, y },
        holeDiameterMm: profile.recommendedHoleDiameterMm,
        stoneSize: state.manualTool.addStoneSize,
      };

      // Convert to editable if needed
      if (!state.editableTemplate.isEditable) {
        dispatch({ type: 'CONVERT_TO_EDITABLE' });
      }
      
      dispatch({ type: 'ADD_STONES', stones: [newStone] });
      onNotify?.('Stone added.', 'success');
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
      <div className="w-full h-full flex items-center justify-center p-8">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="border border-zinc-600 bg-white max-w-full max-h-full"
          style={{
            transform: `scale(${state.canvas.zoom}) translate(${state.canvas.panX}px, ${state.canvas.panY}px)`,
            transformOrigin: 'center',
            transition: dragState?.isDragging ? 'none' : 'transform 0.1s ease-out',
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
                id="grid"
                width={state.canvas.gridSizeMm}
                height={state.canvas.gridSizeMm}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${state.canvas.gridSizeMm} 0 L 0 0 0 ${state.canvas.gridSizeMm}`}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
          )}
          {state.canvas.showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

          {/* Stones */}
          {stones.map((stone) => {
            const isSelected = state.selectedStoneIds.has(stone.id);
            
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
            
            return (
              <g key={stone.id}>
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={displayX}
                    cy={displayY}
                    r={r + 0.5}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="0.5"
                    strokeDasharray="1 1"
                  />
                )}
                
                {/* Stone hole */}
                <circle
                  cx={displayX}
                  cy={displayY}
                  r={r}
                  fill="none"
                  stroke={
                    typeof stone.metadata?.fill === 'string'
                      ? stone.metadata.fill
                      : typeof stone.metadata?.stroke === 'string'
                        ? stone.metadata.stroke
                        : '#9333ea'
                  }
                  strokeWidth="0.3"
                  className={state.activeTool === 'select' ? 'cursor-pointer hover:fill-purple-100 transition' : ''}
                  onPointerDown={(e) => handleStoneMouseDown(e, stone.id)}
                />
              </g>
            );
          })}

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
            <circle
              cx={hoverPosition.x}
              cy={hoverPosition.y}
              r={getStoneSizeProfile(state.manualTool.addStoneSize).recommendedHoleDiameterMm / 2}
              fill="none"
              stroke={hoverCollision ? '#ef4444' : '#9333ea'}
              strokeWidth="0.3"
              strokeDasharray="2 2"
              opacity="0.5"
              pointerEvents="none"
            />
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
