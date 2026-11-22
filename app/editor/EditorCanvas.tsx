'use client';

import type { PlacedShape } from '@/src/lib/rhinestone-engine/index';
import { isNudgeKey, nudgeMoves } from './nudge';
import { AB_COLOUR, applyDesignColour, gemShades, stoneColourOf } from './stoneColours';
import { describeDesignForScreenReader } from './editorUi';
import { PART_SNAP_MM, boundsOfStones, partsStones, snapOffset } from './designParts';

import { Expand, Gem, Grid2X2, Minus, Plus, Scan } from 'lucide-react';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { getRecommendedCenterDistance, getStoneSizeProfile } from '@/src/lib/rhinestone-engine/index';
import { EditorAction, EditorState, EditableStone, ManualDrawMode } from './EditorState';
import {
  calculateCanvasWorkspaceBounds,
  calculateFitViewTransform,
  clampCanvasPan,
  calculateDisplayedCanvasViewBox,
  expandViewBoxToAspect,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  screenToMm,
  snapToGrid,
  isPointNearStone,
  interpolateLinePointsAtSpacing,
  mmToRulerPercent,
  CanvasTransform,
} from './canvasCoordinates';
import { findNearestValidStonePosition, wouldCollide } from './collisionDetection';
import { isIgnoredKeyboardTarget } from './editorDomGuards';
import { isActivatableControl } from '../lib/studioShortcuts';
import { useTouchViewGestures } from '../lib/touchGestures';
import { findSnapCandidates, type SnapGuideLine } from './alignmentGuides';
import {
  applyBoxSelection,
  BOX_SELECTION_DRAG_THRESHOLD_PX,
  createSelectionBoxMm,
  hasExceededBoxSelectionThreshold,
  shouldStartBoxSelection,
} from './selectionBox';
import { IconButton } from './ui';

interface EditorCanvasProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onNotify?: (message: string, tone: 'success' | 'warning' | 'error' | 'info') => void;
  /** The artwork as drawn, shown faintly behind the stones. */
  artworkSource?: PlacedShape[] | null;
  fitRequestId?: number;
  onManualViewChange?: (view: { zoom: number; panX: number; panY: number }) => void;
}

/** Width of the line drawn around a stone, in mm. The line sits inside the hole so the picture is to scale. */
const STONE_STROKE_MM = 0.22;

const RULER_BAND_PX = 32;
const RULER_NICE_STEPS_MM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const RULER_TARGET_LABEL_COUNT = 14;
const SELECTION_MEASURE_OFFSET_MM = 18;
const FIT_TO_SCREEN_PADDING_MM = 20;
const FIT_TO_SCREEN_MARGIN = 0.92;

// Rounds up to a "nice" 1/2/5 step so ruler ticks/labels never crowd together at low zoom.
function pickNiceRulerStep(rawStepMm: number): number {
  for (const step of RULER_NICE_STEPS_MM) {
    if (step >= rawStepMm) return step;
  }
  return RULER_NICE_STEPS_MM[RULER_NICE_STEPS_MM.length - 1];
}

function buildRulerTickValues(start: number, end: number, stepMm: number): number[] {
  const first = Math.ceil(start / stepMm) * stepMm;
  const ticks: number[] = [];
  for (let value = first; value <= end; value += stepMm) {
    ticks.push(value);
  }
  return ticks;
}

/** `M x y L x y … Z` for one polyline. */
function polylineToPathData(polyline: { points: ReadonlyArray<{ x: number; y: number }>; closed?: boolean }): string {
  if (polyline.points.length === 0) return '';
  const [first, ...rest] = polyline.points;
  return `M${first!.x.toFixed(2)} ${first!.y.toFixed(2)}${rest.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}${polyline.closed ? 'Z' : ''}`;
}

const gemId = (hex: string) => `gem-${hex.replace('#', '').toLowerCase()}`;

/** The gradient a shiny stone of this colour is filled with: a highlight up and to the left, the colour, a darker rim. */
function GemGradient({ hex }: { hex: string }) {
  if (hex.toLowerCase() === AB_COLOUR) {
    return (
      <radialGradient id={gemId(hex)} cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.3" stopColor="#f7d9ff" />
        <stop offset="0.55" stopColor="#b9d9ff" />
        <stop offset="0.8" stopColor="#c4f2e0" />
        <stop offset="1" stopColor="#9a8ad6" />
      </radialGradient>
    );
  }
  const shades = gemShades(hex);
  return (
    <radialGradient id={gemId(hex)} cx="0.38" cy="0.32" r="0.8">
      <stop offset="0" stopColor={shades.highlight} />
      <stop offset="0.4" stopColor={shades.body} />
      <stop offset="1" stopColor={shades.rim} />
    </radialGradient>
  );
}

function getStoneCanvasColor(stone: EditableStone, showStoneColours: boolean): string {
  if (showStoneColours) {
    const colour = stoneColourOf(stone);
    if (colour) return colour;
  }
  if (typeof stone.metadata?.fill === 'string') return stone.metadata.fill;
  if (typeof stone.metadata?.stroke === 'string') return stone.metadata.stroke;
  return '#8b5cf6';
}

export default function EditorCanvas({
  state,
  dispatch: rawDispatch,
  onNotify,
  fitRequestId = 0,
  onManualViewChange: rawOnManualViewChange,
  artworkSource = null,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef(false);
  const nextStoneIdRef = useRef(0);

  // Every way of moving the view (wheel, drag, pinch, zoom about the cursor) goes through these two
  // wrappers, which keep the design in reach: it can never be scrolled out of sight (clampCanvasPan).
  const clampContextRef = useRef<{
    workspace: { x: number; y: number; width: number; height: number };
    content: { x: number; y: number; width: number; height: number };
    aspect: number | null;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);
  const clampView = useCallback((view: { zoom: number; panX: number; panY: number }) => {
    const ctx = clampContextRef.current;
    if (!ctx) return view;
    return { ...view, ...clampCanvasPan({ workspace: ctx.workspace, content: ctx.content, aspect: ctx.aspect, ...view }) };
  }, []);
  const dispatch = useCallback((action: EditorAction) => {
    const ctx = clampContextRef.current;
    if (ctx && action.type === 'UPDATE_CANVAS' && (action.updates.panX !== undefined || action.updates.panY !== undefined)) {
      const view = clampView({
        zoom: action.updates.zoom ?? ctx.zoom,
        panX: action.updates.panX ?? ctx.panX,
        panY: action.updates.panY ?? ctx.panY,
      });
      rawDispatch({ type: 'UPDATE_CANVAS', updates: { ...action.updates, panX: view.panX, panY: view.panY } });
      return;
    }
    rawDispatch(action);
  }, [clampView, rawDispatch]);
  const onManualViewChange = useCallback(
    (view: { zoom: number; panX: number; panY: number }) => rawOnManualViewChange?.(clampView(view)),
    [clampView, rawOnManualViewChange],
  );

  // Hover state for manual tool
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoverSuggestedFrom, setHoverSuggestedFrom] = useState<{ x: number; y: number } | null>(null);
  const [hoverCollision, setHoverCollision] = useState<boolean>(false);
  const [recentPlacedStoneIds, setRecentPlacedStoneIds] = useState<Set<string>>(new Set());
  const [hoveredStoneId, setHoveredStoneId] = useState<string | null>(null);
  const [drawState, setDrawState] = useState<{
    pointerId: number;
    lastPlacedX: number;
    lastPlacedY: number;
    pendingStones: EditableStone[];
    mode: ManualDrawMode;
    originX: number;
    originY: number;
    lockedAxis: 'x' | 'y' | null;
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

  // Alignment guides shown while dragging a single stone
  const [snapGuides, setSnapGuides] = useState<SnapGuideLine[]>([]);

  // Determine which stones to render
  const stones = useMemo(() => {
    const working = state.editableTemplate.isEditable ? state.editableTemplate.stones : state.template?.stones || [];
    // Parts kept with "Add to design" are drawn with the rest; they are changed from the parts list, not on the canvas.
    const all = state.parts.length > 0 ? [...working, ...partsStones(state.parts)] : working;
    return state.designStoneColour ? applyDesignColour(all, state.designStoneColour) : all;
  }, [state.template, state.editableTemplate, state.parts, state.designStoneColour]);
  // Once any stone has a colour the canvas shows the colours, so the design reads like the real thing.
  const showStoneColours = useMemo(() => stones.some((stone) => stoneColourOf(stone) !== null), [stones]);
  const realistic = state.canvas.realisticStones;
  // The colours in use, each drawn with its own gradient so a stone looks like a stone that catches the light.
  const gemColours = useMemo(() => (realistic ? [...new Set(stones.map((stone) => getStoneCanvasColor(stone, showStoneColours).toLowerCase()))] : []), [realistic, stones, showStoneColours]);

  // Cut shapes (e.g. letter-stencil card frames) — not stored on the
  // editable snapshot, so fall back to the pre-edit template when editable.
  const cutShapes = useMemo(() => {
    if (state.editableTemplate.isEditable) {
      return state.editableTemplate.originalTemplate?.cutShapes ?? [];
    }
    return state.template?.cutShapes ?? [];
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

  const resolveManualPlacement = (
    rawX: number,
    rawY: number,
    extraStones: readonly EditableStone[] = [],
    snapOverride?: boolean,
  ) => {
    let x = rawX;
    let y = rawY;

    if (snapOverride ?? state.manualTool.snapToGrid) {
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

  // Row/column lock: once the drag has moved far enough from its origin,
  // the stroke commits to whichever axis has the larger displacement, and
  // every later point is pinned to that axis so the row/column comes out
  // straight even if the pointer path wobbles.
  const ROW_LOCK_THRESHOLD_MM = Math.max(manualDrawSpacingMm / 3, 0.75);

  const resolveDrawPoint = (
    rawX: number,
    rawY: number,
    extraStones: readonly EditableStone[],
    mode: ManualDrawMode,
    lockedAxis: 'x' | 'y' | null,
    originX: number,
    originY: number,
  ) => {
    let x = rawX;
    let y = rawY;

    if (mode === 'row' && lockedAxis === 'x') {
      y = originY;
    } else if (mode === 'row' && lockedAxis === 'y') {
      x = originX;
    }

    if (mode === 'grid') {
      // Hard grid snap: a stone that would collide is skipped rather than
      // nudged off-grid, so placement stays exactly predictable.
      return { ...resolveManualPlacement(x, y, extraStones, true), nudged: false };
    }

    if (mode === 'row') {
      return { ...resolveManualPlacement(x, y, extraStones), nudged: false };
    }

    return resolveSmartManualPlacement(x, y, extraStones);
  };

  // Alignment-guide snap for the pen tool: nudges a freehand-mode point onto
  // an existing stone's x/y center or the workspace centerline when close,
  // and reports the dashed guide line(s) to draw. Only meaningful in
  // freehand mode — grid mode already snaps to a fixed lattice, and row
  // mode already locks to a straight line, so neither needs this.
  const getPenAlignmentSnap = (x: number, y: number) => {
    const workspaceCenter = {
      x: workspaceBounds.x + workspaceBounds.width / 2,
      y: workspaceBounds.y + workspaceBounds.height / 2,
    };
    return findSnapCandidates(x, y, stones.map((stone) => stone.center), workspaceCenter);
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

  // Calculate canvas viewBox based on stones.
  // Not wrapped in useMemo: the React Compiler's own auto-memoization pass
  // could not preserve a manual memo boundary here (bailed out of
  // optimizing the whole component as a result) — calculateCanvasWorkspaceBounds
  // is a cheap O(stones) bounding-box scan, so a plain call is fine either way.
  const workspaceBounds = calculateCanvasWorkspaceBounds(stones);
  // The SVG's real on-screen size. The view box is grown to this shape (see expandViewBoxToAspect) so it
  // fills the canvas on any screen, a tall phone included, and pointer positions convert to mm exactly.
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null);
  const baseViewBox = useMemo(
    () => calculateDisplayedCanvasViewBox(workspaceBounds, state.canvas.zoom, state.canvas.panX, state.canvas.panY),
    [workspaceBounds, state.canvas.zoom, state.canvas.panX, state.canvas.panY],
  );
  const viewBox = useMemo(
    () => (viewportSize ? expandViewBoxToAspect(baseViewBox, viewportSize.width / viewportSize.height) : baseViewBox),
    [baseViewBox, viewportSize],
  );

  // Ruler tick/label spacing adapts to zoom so labels never crowd together when zoomed out.
  const rulerLabelStepMm = useMemo(
    () => pickNiceRulerStep(viewBox.width / RULER_TARGET_LABEL_COUNT),
    [viewBox.width],
  );
  const rulerTickStepMm = useMemo(
    () => pickNiceRulerStep(rulerLabelStepMm / 5),
    [rulerLabelStepMm],
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
    const zoom = Math.min(state.canvas.zoom * 1.2, MAX_CANVAS_ZOOM);
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom } });
    onManualViewChange?.({ zoom, panX: state.canvas.panX, panY: state.canvas.panY });
  };

  const handleZoomOut = () => {
    const zoom = Math.max(state.canvas.zoom / 1.2, MIN_CANVAS_ZOOM);
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom } });
    onManualViewChange?.({ zoom, panX: state.canvas.panX, panY: state.canvas.panY });
  };

  const handleZoomReset = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });
    onManualViewChange?.({ zoom: 1, panX: 0, panY: 0 });
  };

  // Fits the actual design (not the padded default workspace) snugly into the
  // real, current pixel size of the canvas — distinct from "reset to 100%".
  const fitToScreen = useCallback(() => {
    if (stones.length === 0) {
      dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });
      return;
    }

    const contentBounds = calculateCanvasWorkspaceBounds(stones, {
      paddingMm: FIT_TO_SCREEN_PADDING_MM,
      minWidthMm: 0,
      minHeightMm: 0,
    });

    const rect = viewportRef.current?.getBoundingClientRect();
    const fit = calculateFitViewTransform(
      workspaceBounds,
      contentBounds,
      { widthPx: rect?.width ?? 1, heightPx: rect?.height ?? 1 },
      { margin: FIT_TO_SCREEN_MARGIN, minZoom: 0.1, maxZoom: 100 },
    );

    dispatch({
      type: 'UPDATE_CANVAS',
      updates: {
        zoom: fit.zoom,
        panX: fit.panX,
        panY: fit.panY,
      },
    });
  }, [dispatch, stones, workspaceBounds]);

  const handleFitToScreen = () => {
    fitToScreen();
  };

  const fitToScreenRef = useRef(fitToScreen);

  useEffect(() => {
    fitToScreenRef.current = fitToScreen;
  }, [fitToScreen]);

  useEffect(() => {
    if (fitRequestId <= 0) return;
    fitToScreenRef.current();
  }, [fitRequestId]);

  const toggleGrid = () => {
    dispatch({ type: 'UPDATE_CANVAS', updates: { showGrid: !state.canvas.showGrid } });
  };

  // Kept fresh after every commit so the wheel handler (bound once per zoom
  // change) can read current viewBox/workspace bounds without needing to rebind.
  const viewBoxRef = useRef(viewBox);
  const workspaceBoundsRef = useRef(workspaceBounds);
  useEffect(() => {
    viewBoxRef.current = viewBox;
    workspaceBoundsRef.current = workspaceBounds;

    // What the pan limit works from: the stones' bounds (or the workspace when empty) and the current view.
    let content = workspaceBounds;
    if (stones.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const stone of stones) {
        const radius = stone.holeDiameterMm / 2;
        minX = Math.min(minX, stone.center.x - radius);
        minY = Math.min(minY, stone.center.y - radius);
        maxX = Math.max(maxX, stone.center.x + radius);
        maxY = Math.max(maxY, stone.center.y + radius);
      }
      content = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    clampContextRef.current = {
      workspace: workspaceBounds,
      content,
      aspect: viewportSize ? viewportSize.width / viewportSize.height : null,
      zoom: state.canvas.zoom,
      panX: state.canvas.panX,
      panY: state.canvas.panY,
    };
  }, [viewBox, workspaceBounds, stones, viewportSize, state.canvas.zoom, state.canvas.panX, state.canvas.panY]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setViewportSize((previous) =>
        previous && Math.abs(previous.width - rect.width) < 0.5 && Math.abs(previous.height - rect.height) < 0.5
          ? previous
          : { width: rect.width, height: rect.height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Drops whatever one finger / the mouse had started (drag, draw, pan, box select) without applying it.
  const cancelInteractions = () => {
    const svg = svgRef.current;
    const pointerIds = [drawState?.pointerId, boxSelection?.pointerId].filter((id): id is number => id !== undefined);
    for (const id of pointerIds) {
      if (svg?.hasPointerCapture(id)) svg.releasePointerCapture(id);
    }
    setDrawState(null);
    setDragState(null);
    setPanState(null);
    setBoxSelection(null);
    setSnapGuides([]);
    setHoverPosition(null);
  };

  // Two fingers pinch-zoom and pan the view; one finger keeps working as the active tool.
  useTouchViewGestures(svgRef, {
    minZoom: MIN_CANVAS_ZOOM,
    maxZoom: MAX_CANVAS_ZOOM,
    getView: () => ({ zoom: state.canvas.zoom, viewBox: viewBoxRef.current }),
    onGestureStart: cancelInteractions,
    applyView: ({ zoom, viewBox: next }) => {
      const bounds = workspaceBoundsRef.current;
      const view = {
        zoom,
        panX: bounds.x + bounds.width / 2 - (next.x + next.width / 2),
        panY: bounds.y + bounds.height / 2 - (next.y + next.height / 2),
      };
      dispatch({ type: 'UPDATE_CANVAS', updates: view });
      onManualViewChange?.(view);
    },
  });

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
      onManualViewChange?.({
        zoom: state.canvas.zoom,
        panX: panState.startPanX + dx * mmPerPxX,
        panY: panState.startPanY + dy * mmPerPxY,
      });
      return;
    }

    if (drawState) {
      const svg = svgRef.current;
      const transform = getCanvasTransform();
      if (!svg || !transform) return;

      const rawPos = screenToMm(e.clientX, e.clientY, svg, transform);

      // Row/column lock commits to an axis the first time the drag moves far
      // enough from its origin; every point from then on stays pinned to it.
      let lockedAxis = drawState.lockedAxis;
      if (drawState.mode === 'row' && lockedAxis === null) {
        const dx = rawPos.x - drawState.originX;
        const dy = rawPos.y - drawState.originY;
        if (Math.hypot(dx, dy) >= ROW_LOCK_THRESHOLD_MM) {
          lockedAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        }
      }

      const alignmentSnap = drawState.mode === 'freehand' ? getPenAlignmentSnap(rawPos.x, rawPos.y) : null;
      setSnapGuides(alignmentSnap?.guides ?? []);
      const currentPos = { x: alignmentSnap?.x ?? rawPos.x, y: alignmentSnap?.y ?? rawPos.y };

      const resolvedCurrent = resolveDrawPoint(
        currentPos.x,
        currentPos.y,
        drawState.pendingStones,
        drawState.mode,
        lockedAxis,
        drawState.originX,
        drawState.originY,
      );
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
        setDrawState({ ...drawState, lockedAxis });
        return;
      }

      let lastPlacedX = drawState.lastPlacedX;
      let lastPlacedY = drawState.lastPlacedY;
      const pendingStones = [...drawState.pendingStones];
      for (const point of sampledPoints) {
        const candidate = resolveDrawPoint(point.x, point.y, pendingStones, drawState.mode, lockedAxis, drawState.originX, drawState.originY);
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
        lockedAxis,
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
      const showAlignmentSnap = state.manualTool.interactionMode === 'place' && state.manualTool.drawMode === 'freehand';
      const alignmentSnap = showAlignmentSnap ? getPenAlignmentSnap(pos.x, pos.y) : null;
      setSnapGuides(alignmentSnap?.guides ?? []);
      const snappedX = alignmentSnap?.x ?? pos.x;
      const snappedY = alignmentSnap?.y ?? pos.y;
      const resolved = state.manualTool.interactionMode === 'place'
        ? resolveDrawPoint(snappedX, snappedY, [], state.manualTool.drawMode, null, snappedX, snappedY)
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
      let dx = currentPos.x - dragState.dragStartX;
      let dy = currentPos.y - dragState.dragStartY;
      let guides: SnapGuideLine[] = [];

      // Snap-to-neighbors only makes sense for a single stone, and would
      // fight with explicit grid snapping, so the two are mutually exclusive.
      if (state.selectedStoneIds.size === 1 && !state.manualTool.snapToGrid) {
        const [singleId] = Array.from(state.selectedStoneIds);
        const original = dragState.originalPositions.get(singleId);
        if (original) {
          const otherStones = stones
            .filter((stone) => stone.id !== singleId)
            .map((stone) => ({ x: stone.center.x, y: stone.center.y }));
          const workspaceCenter = {
            x: workspaceBounds.x + workspaceBounds.width / 2,
            y: workspaceBounds.y + workspaceBounds.height / 2,
          };
          const snapped = findSnapCandidates(original.x + dx, original.y + dy, otherStones, workspaceCenter);
          dx = snapped.x - original.x;
          dy = snapped.y - original.y;
          guides = snapped.guides;
        }
      }

      // Update drag state with current delta
      setDragState({
        ...dragState,
        currentDx: dx,
        currentDy: dy,
      });
      setSnapGuides(guides);
    } else {
      setHoverPosition(null);
      setHoverCollision(false);
    }
  };

  const handleMouseLeave = () => {
    if (boxSelection || drawState || eraseState) return;
    setSnapGuides([]);
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
  // Dragging a kept part: it moves by the pointer's travel, rounded to 0.1 mm; one drag is one undo step.
  const startPartDrag = (e: React.PointerEvent<SVGCircleElement>, partId: string) => {
    if (spacePressed || e.button === 1 || e.button === 2) return;
    const svg = svgRef.current;
    const transform = getCanvasTransform();
    const part = state.parts.find((candidate) => candidate.id === partId);
    if (!svg || !transform || !part) return;
    e.stopPropagation();
    const start = screenToMm(e.clientX, e.clientY, svg, transform);
    const { offsetX, offsetY } = part;
    // Where the part is now and where everything else is, to snap against while dragging.
    const ownBounds = boundsOfStones(partsStones([part]));
    const workingNow = state.editableTemplate.isEditable ? state.editableTemplate.stones : state.template?.stones ?? [];
    const otherBounds = [
      boundsOfStones(workingNow),
      ...state.parts.filter((candidate) => candidate.id !== partId).map((candidate) => boundsOfStones(partsStones([candidate]))),
    ].filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== null);
    dispatch({ type: 'END_PARTS_STEP' });
    const move = (event: PointerEvent) => {
      const current = getCanvasTransform();
      if (!current) return;
      const point = screenToMm(event.clientX, event.clientY, svg, current);
      let nextX = offsetX + point.x - start.x;
      let nextY = offsetY + point.y - start.y;
      // The part clicks into line with the edges and middles of the other pieces when it comes within 2 mm; hold Alt to move freely.
      if (!event.altKey && ownBounds) {
        const moved = { minX: ownBounds.minX + nextX - offsetX, maxX: ownBounds.maxX + nextX - offsetX, minY: ownBounds.minY + nextY - offsetY, maxY: ownBounds.maxY + nextY - offsetY };
        const snap = snapOffset(moved, otherBounds, PART_SNAP_MM);
        nextX += snap.x;
        nextY += snap.y;
      }
      dispatch({
        type: 'UPDATE_PART',
        id: partId,
        updates: { offsetX: Math.round(nextX * 10) / 10, offsetY: Math.round(nextY * 10) / 10 },
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      dispatch({ type: 'END_PARTS_STEP' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

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
      setSnapGuides([]);
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
    setSnapGuides([]);
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
      const drawMode = state.manualTool.drawMode;
      const candidate = state.manualTool.interactionMode === 'erase'
        ? resolveManualPlacement(startPos.x, startPos.y)
        : resolveDrawPoint(startPos.x, startPos.y, [], drawMode, null, startPos.x, startPos.y);
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
          mode: drawMode,
          originX: candidate.x,
          originY: candidate.y,
          lockedAxis: null,
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
      
      // Arrow keys: nudge the selected stones (Shift = 5 mm, Alt = 0.1 mm). A move into another stone is refused, as a drag is.
      if (isNudgeKey(e.key) && state.selectedStoneIds.size > 0 && state.editableTemplate.isEditable && !e.metaKey && !e.ctrlKey) {
        const moves = nudgeMoves(state.editableTemplate.stones, state.selectedStoneIds, e.key, { shift: e.shiftKey, alt: e.altKey });
        if (moves) {
          e.preventDefault();
          dispatch({ type: 'MOVE_STONES', moves });
          return;
        }
      }

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

      // Cmd/Ctrl+A: select all editable stones. Always suppress the browser's
      // native "select all page text" here, even when there's nothing
      // editable to select yet.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (state.editableTemplate.isEditable) {
          dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(state.editableTemplate.stones.map((stone) => stone.id)) });
        }
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
  }, [boxSelection, state.selectedStoneIds, state.editableTemplate.isEditable, state.editableTemplate.stones, dispatch]);

  // Mouse wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const currentViewBox = viewBoxRef.current;
      const bounds = workspaceBoundsRef.current;

      // Trackpad pinch (or Ctrl/Cmd + wheel) zooms, keeping the mm point under
      // the cursor fixed. A plain two-finger scroll pans instead — matching
      // standard design-tool behavior (Figma, Google Maps, etc).
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1; // zoom in/out
        const newZoom = Math.min(Math.max(state.canvas.zoom * delta, MIN_CANVAS_ZOOM), MAX_CANVAS_ZOOM);
        if (newZoom === state.canvas.zoom) return;

        const fractionX = (e.clientX - rect.left) / rect.width;
        const fractionY = (e.clientY - rect.top) / rect.height;
        const cursorMmX = currentViewBox.x + fractionX * currentViewBox.width;
        const cursorMmY = currentViewBox.y + fractionY * currentViewBox.height;

        // The shown box scales with 1/zoom (it is the workspace grown to the canvas shape).
        const nextWidth = currentViewBox.width * (state.canvas.zoom / newZoom);
        const nextHeight = currentViewBox.height * (state.canvas.zoom / newZoom);
        const nextCenterX = cursorMmX - fractionX * nextWidth + nextWidth / 2;
        const nextCenterY = cursorMmY - fractionY * nextHeight + nextHeight / 2;

        dispatch({
          type: 'UPDATE_CANVAS',
          updates: {
            zoom: newZoom,
            panX: bounds.x + bounds.width / 2 - nextCenterX,
            panY: bounds.y + bounds.height / 2 - nextCenterY,
          },
        });
        onManualViewChange?.({
          zoom: newZoom,
          panX: bounds.x + bounds.width / 2 - nextCenterX,
          panY: bounds.y + bounds.height / 2 - nextCenterY,
        });
        return;
      }

      const mmPerPxX = currentViewBox.width / rect.width;
      const mmPerPxY = currentViewBox.height / rect.height;
      const currentCenterX = currentViewBox.x + currentViewBox.width / 2;
      const currentCenterY = currentViewBox.y + currentViewBox.height / 2;
      const currentPanX = bounds.x + bounds.width / 2 - currentCenterX;
      const currentPanY = bounds.y + bounds.height / 2 - currentCenterY;

      dispatch({
        type: 'UPDATE_CANVAS',
        updates: {
          panX: currentPanX - e.deltaX * mmPerPxX,
          panY: currentPanY - e.deltaY * mmPerPxY,
        },
      });
      onManualViewChange?.({
        zoom: state.canvas.zoom,
        panX: currentPanX - e.deltaX * mmPerPxX,
        panY: currentPanY - e.deltaY * mmPerPxY,
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [state.canvas.zoom, dispatch, onManualViewChange]);

  // Space key pan state
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !spacePressed) {
        // Space also activates a focused button/link/summary; never swallow it there.
        if (!isIgnoredKeyboardTarget(e.target) && !isActivatableControl(e.target)) {
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

  const hasCanvasContent = stones.length > 0 || cutShapes.length > 0;

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-[var(--studio-surface)]">
      <div className="absolute left-4 top-4 z-10 max-w-[min(360px,calc(100%-2rem))] rounded-md max-lg:hidden border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-3 py-2 shadow-md backdrop-blur-sm">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--studio-ink-subtle)]">Canvas</div>
        <div className="mt-1 text-xs text-[var(--studio-ink-muted)]">
          {hasCanvasContent ? `${stones.length} stones · ${state.canvas.showGrid ? 'grid on' : 'grid off'}` : 'Pick a source or draw directly to start'}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-10 flex gap-1 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 p-1 shadow-md backdrop-blur-sm lg:flex-col lg:p-1.5">
        <IconButton onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </IconButton>
        <IconButton onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </IconButton>
        <IconButton onClick={handleZoomReset} title="Reset zoom to 100%" aria-label="Reset zoom">
          <Scan className="h-4 w-4" />
        </IconButton>
        <IconButton onClick={handleFitToScreen} title="Fit the design to the current canvas view" aria-label="Fit to screen">
          <Expand className="h-4 w-4" />
        </IconButton>
        <div className="mx-1 w-px bg-border lg:mx-0 lg:my-1 lg:h-px lg:w-auto" />
        <IconButton
          onClick={() => dispatch({ type: 'UPDATE_CANVAS', updates: { realisticStones: !state.canvas.realisticStones } })}
          intent={state.canvas.realisticStones ? 'active' : 'default'}
          title={state.canvas.realisticStones ? 'Show flat holes' : 'Show shiny stones'}
          aria-label="Toggle shiny stones"
          aria-pressed={state.canvas.realisticStones}
        >
          <Gem className="h-4 w-4" />
        </IconButton>
        <IconButton
          onClick={toggleGrid}
          intent={state.canvas.showGrid ? 'active' : 'default'}
          title={state.canvas.showGrid ? 'Hide grid overlay' : 'Show grid overlay'}
          aria-label="Toggle grid"
        >
          <Grid2X2 className="h-4 w-4" />
        </IconButton>
      </div>

      {/* SVG Canvas */}
      <div className="h-full w-full p-4 lg:p-8">
        <div
          className="grid h-full w-full overflow-hidden rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-bg)] shadow-2xl shadow-black/30"
          style={{
            gridTemplateColumns: state.canvas.showRulers ? `${RULER_BAND_PX}px 1fr` : '1fr',
            gridTemplateRows: state.canvas.showRulers ? `${RULER_BAND_PX}px 1fr` : '1fr',
          }}
        >
          {state.canvas.showRulers && (
            <>
              <div className="border-b border-r border-[var(--studio-border)] bg-[var(--studio-well)]" style={{ gridColumn: 1, gridRow: 1 }} />
              <div
                className="relative overflow-hidden border-b border-[var(--studio-border)] bg-[var(--studio-well)]"
                style={{ gridColumn: 2, gridRow: 1 }}
              >
                {buildRulerTickValues(viewBox.x, viewBox.x + viewBox.width, rulerTickStepMm).map((tick) => (
                  <div
                    key={`overlay-top-${tick}`}
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: mmToRulerPercent(tick, viewBox.x, viewBox.width) }}
                  >
                    <div className={`w-px bg-[var(--studio-surface-hover)] ${tick % rulerLabelStepMm === 0 ? 'h-full' : 'h-2.5'} self-end`} />
                    {tick % rulerLabelStepMm === 0 && (
                      <span className="absolute left-1 top-1 text-xs font-medium leading-none text-[var(--studio-ink-subtle)]">
                        {Math.round(tick)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div
                className="relative overflow-hidden border-r border-[var(--studio-border)] bg-[var(--studio-well)]"
                style={{ gridColumn: 1, gridRow: 2 }}
              >
                {buildRulerTickValues(viewBox.y, viewBox.y + viewBox.height, rulerTickStepMm).map((tick) => (
                  <div
                    key={`overlay-left-${tick}`}
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: mmToRulerPercent(tick, viewBox.y, viewBox.height) }}
                  >
                    <div className={`h-px bg-[var(--studio-surface-hover)] ${tick % rulerLabelStepMm === 0 ? 'w-full' : 'w-2.5'} justify-self-end`} />
                    {tick % rulerLabelStepMm === 0 && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-medium leading-none text-[var(--studio-ink-subtle)]">
                        {Math.round(tick)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div
            ref={viewportRef}
            className="relative h-full w-full"
            style={{ gridColumn: state.canvas.showRulers ? 2 : 1, gridRow: state.canvas.showRulers ? 2 : 1 }}
          >
            <svg
              ref={svgRef}
              data-design-canvas=""
              role="img"
              aria-label={describeDesignForScreenReader(stones, state.selectedStoneIds.size)}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full touch-none bg-[var(--studio-bg)]"
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
              onPointerCancel={cancelInteractions}
              onContextMenu={(e) => e.preventDefault()}
            >
          {/* Grid */}
          {state.canvas.showGrid && (
            <defs>
              {realistic && gemColours.map((hex) => <GemGradient key={hex} hex={hex} />)}
              <pattern
                id="grid-minor"
                width={state.canvas.gridSizeMm}
                height={state.canvas.gridSizeMm}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${state.canvas.gridSizeMm} 0 L 0 0 0 ${state.canvas.gridSizeMm}`}
                  fill="none"
                  stroke="#2f2f36"
                  strokeWidth="0.35"
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
                  stroke="#45454e"
                  strokeWidth="0.65"
                />
              </pattern>
            </defs>
          )}
          {state.canvas.showGrid && (
            <>
              {/* Covers the whole visible area, wherever the view is, so panning never leaves the grid. */}
              <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-minor)" />
              <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-major)" opacity="0.95" />
            </>
          )}

          {/* Cut shapes (e.g. letter-stencil card frames) */}
          {cutShapes.map((shape) => (
            <rect
              key={shape.id ?? `${shape.x}-${shape.y}`}
              x={shape.x}
              y={shape.y}
              width={shape.widthMm}
              height={shape.heightMm}
              rx={shape.cornerRadiusMm ?? 0}
              ry={shape.cornerRadiusMm ?? 0}
              fill="none"
              stroke="#7c4dff"
              strokeWidth="0.3"
              strokeDasharray="1.4 1"
              opacity="0.8"
            />
          ))}

          {/* The artwork as drawn, behind the stones, so the stones can be judged against the real shape. */}
          {artworkSource && state.activeTool === 'svg' && state.svgTool.showSourceBehind && (
            <g aria-hidden="true" pointerEvents="none" data-testid="artwork-source">
              {artworkSource.map((shape, index) => (
                <path
                  key={index}
                  d={shape.polylines.map(polylineToPathData).join(' ')}
                  fill={shape.fill ?? 'none'}
                  fillOpacity={0.28 * shape.fillOpacity}
                  fillRule={shape.fillRule}
                  stroke={shape.stroke ?? 'none'}
                  strokeOpacity={0.28 * shape.strokeOpacity}
                  strokeWidth={shape.strokeWidthMm}
                  strokeLinejoin="round"
                />
              ))}
            </g>
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
            const baseColor = getStoneCanvasColor(stone, showStoneColours);
            
            const isHovered = hoveredStoneId === stone.id;
            // A stone of a kept part is dragged as a whole (see startPartDrag); it is not edited stone by stone.
            const isPartStone = typeof stone.metadata?.partId === 'string';

            return (
              <g key={stone.id}>
                {/* Hover ring (select tool only) */}
                {isHovered && !isSelected && state.activeTool === 'select' && (
                  <circle cx={displayX} cy={displayY} r={r + 0.7} fill="none" stroke="#b7a0ff" strokeWidth="0.7" />
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={displayX}
                    cy={displayY}
                    r={r + 0.9}
                    fill="none"
                    stroke="#7c4dff"
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
                    stroke="#e8960b"
                    strokeWidth="0.9"
                    strokeDasharray="1.5 1.5"
                    opacity="0.95"
                  />
                )}

                {/* Stone hole: drawn to scale. The outer edge of the stroke is the hole, so the gap between two
                    stones on the canvas is the real gap (a thicker stroke made a cuttable layout look overlapped). */}
                <circle
                  cx={displayX}
                  cy={displayY}
                  r={r - STONE_STROKE_MM / 2}
                  fill={isPendingErase ? 'rgba(228,69,59,0.18)' : realistic ? `url(#${gemId(baseColor)})` : baseColor}
                  fillOpacity={isPendingErase ? 0.18 : realistic ? 1 : showStoneColours ? 0.95 : isSelected ? 0.6 : isRecentlyPlaced ? 0.6 : 0.5}
                  stroke={
                    isPendingErase
                      ? '#e4453b'
                      : realistic ? gemShades(baseColor).rim : showStoneColours ? 'rgba(255,255,255,0.55)' : baseColor
                  }
                  strokeWidth={isPendingErase ? '0.5' : STONE_STROKE_MM}
                  strokeDasharray={isPendingErase ? '1.2 1.2' : undefined}
                  pointerEvents={isPartStone && state.activeTool === 'manual' ? 'none' : undefined}
                  className={isPartStone ? 'cursor-move' : state.activeTool === 'select' ? 'cursor-pointer transition' : ''}
                  onPointerDown={(e) => (isPartStone ? startPartDrag(e, stone.metadata!.partId as string) : handleStoneMouseDown(e, stone.id))}
                  onPointerEnter={() => state.activeTool === 'select' && setHoveredStoneId(stone.id)}
                  onPointerLeave={() => setHoveredStoneId((current) => (current === stone.id ? null : current))}
                />
              </g>
            );
          })}

          {snapGuides.map((guide) => (
            <line
              key={`snap-${guide.axis}-${guide.value}`}
              x1={guide.axis === 'x' ? guide.value : viewBox.x}
              y1={guide.axis === 'x' ? viewBox.y : guide.value}
              x2={guide.axis === 'x' ? guide.value : viewBox.x + viewBox.width}
              y2={guide.axis === 'x' ? viewBox.y + viewBox.height : guide.value}
              stroke="#7c4dff"
              strokeWidth="0.2"
              strokeDasharray="1.5 1.5"
              opacity="0.8"
              pointerEvents="none"
            />
          ))}

          {selectionBounds && (
            <g pointerEvents="none">
              <rect
                x={selectionBounds.minX}
                y={selectionBounds.minY}
                width={selectionBounds.width}
                height={selectionBounds.height}
                fill="none"
                stroke="#7c4dff"
                strokeWidth="0.25"
                strokeDasharray="2 2"
                opacity="0.7"
              />

              <line
                x1={selectionBounds.minX}
                y1={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM}
                x2={selectionBounds.maxX}
                y2={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM}
                stroke="#7c4dff"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.minX}
                y1={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM + 3}
                x2={selectionBounds.minX}
                y2={selectionBounds.minY}
                stroke="#7c4dff"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.maxX}
                y1={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM + 3}
                x2={selectionBounds.maxX}
                y2={selectionBounds.minY}
                stroke="#7c4dff"
                strokeWidth="0.25"
              />
              <text
                x={(selectionBounds.minX + selectionBounds.maxX) / 2}
                y={selectionBounds.minY - SELECTION_MEASURE_OFFSET_MM - 2}
                textAnchor="middle"
                fontSize="6"
                fill="#5024be"
              >
                {selectionBounds.width.toFixed(1)} mm
              </text>

              <line
                x1={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM}
                y1={selectionBounds.minY}
                x2={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM}
                y2={selectionBounds.maxY}
                stroke="#7c4dff"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM + 3}
                y1={selectionBounds.minY}
                x2={selectionBounds.minX}
                y2={selectionBounds.minY}
                stroke="#7c4dff"
                strokeWidth="0.25"
              />
              <line
                x1={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM + 3}
                y1={selectionBounds.maxY}
                x2={selectionBounds.minX}
                y2={selectionBounds.maxY}
                stroke="#7c4dff"
                strokeWidth="0.25"
              />
              <text
                x={selectionBounds.minX - SELECTION_MEASURE_OFFSET_MM - 2}
                y={(selectionBounds.minY + selectionBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="6"
                fill="#5024be"
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
              fill="#ff9466"
              fillOpacity="0.2"
              stroke="#e24e22"
              strokeWidth="0.6"
              strokeDasharray="1.2 1.2"
              opacity="0.95"
            />
          ))}

          {boxSelection && (
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
                  fill="#7c4dff1a"
                  stroke="#7c4dff"
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
                    <line x1={hoverSuggestedFrom.x} y1={hoverSuggestedFrom.y} x2={hoverPosition.x} y2={hoverPosition.y} stroke="#e8960b" strokeWidth="0.25" strokeDasharray="1.5 1.5" opacity="0.7" />
                    <circle
                      cx={hoverSuggestedFrom.x}
                      cy={hoverSuggestedFrom.y}
                      r={getStoneSizeProfile(state.manualTool.addStoneSize).recommendedHoleDiameterMm / 2}
                      fill="none"
                      stroke="#e4453b"
                      strokeWidth="0.25"
                      strokeDasharray="1 1"
                      opacity="0.7"
                    />
                  </>
                )}
              <line x1={viewBox.x} y1={hoverPosition.y} x2={viewBox.x + viewBox.width} y2={hoverPosition.y} stroke={state.manualTool.interactionMode === 'erase' ? '#e4453b' : '#9b7cff'} strokeWidth="0.15" strokeDasharray="1.5 1.5" opacity="0.45" />
              <line x1={hoverPosition.x} y1={viewBox.y} x2={hoverPosition.x} y2={viewBox.y + viewBox.height} stroke={state.manualTool.interactionMode === 'erase' ? '#e4453b' : '#9b7cff'} strokeWidth="0.15" strokeDasharray="1.5 1.5" opacity="0.45" />
              <circle
                cx={hoverPosition.x}
                cy={hoverPosition.y}
                  r={state.manualTool.interactionMode === 'erase' ? manualAssistBrushRadiusMm : getStoneSizeProfile(state.manualTool.addStoneSize).recommendedHoleDiameterMm / 2}
                fill={state.manualTool.interactionMode === 'erase' ? '#e4453b' : '#7c4dff'}
                fillOpacity={state.manualTool.interactionMode === 'erase' ? 0.08 : 0.12}
                stroke={state.manualTool.interactionMode === 'erase' ? '#e4453b' : hoverCollision ? '#e4453b' : '#6633e6'}
                strokeWidth="0.45"
                strokeDasharray="2 2"
                opacity="0.65"
              />
            </g>
          )}

        </svg>
          </div>
        </div>
      </div>

      {stones.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">
          <p className="text-base font-semibold text-[var(--studio-ink-secondary)]">Nothing here yet</p>
          <p className="max-w-sm text-sm text-[var(--studio-ink-muted)]">Type a text, upload artwork or pick a starter in the panel on the right.</p>
        </div>
      )}

      {/* Zoom Indicator */}
      <div className="absolute bottom-3 right-3 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:right-4">
        {Math.round(state.canvas.zoom * 100)}%
      </div>

      {/* Manual Tool Status */}
      {state.activeTool === 'manual' && (
        <div className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-3 py-2 text-xs text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:left-4">
          <div>Click to place {state.manualTool.addStoneSize} stone</div>
          {state.manualTool.snapToGrid && (
            <div className="mt-1 text-[var(--studio-ink-muted)]">Snap: {state.manualTool.gridSnapSize}mm grid</div>
          )}
          {hoverPosition && (
            <div className="mt-1 font-mono tabular-nums text-[var(--studio-ink-muted)]">
              X {hoverPosition.x.toFixed(1)} mm · Y {hoverPosition.y.toFixed(1)} mm
            </div>
          )}
          {hoverSuggestedFrom && state.manualTool.interactionMode === 'place' && (
            <div className="mt-1 text-warning-600">Smart assist nudged this stone to a safer spot.</div>
          )}
        </div>
      )}

      {/* Select Tool Status */}
      {state.activeTool === 'select' && state.selectedStoneIds.size > 0 && (
        <div className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-3 py-2 text-xs text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:left-4">
          {state.selectedStoneIds.size} stone{state.selectedStoneIds.size > 1 ? 's' : ''} selected
          <div className="mt-1 text-[var(--studio-ink-muted)]">Delete or drag to move</div>
        </div>
      )}
    </div>
  );
}
