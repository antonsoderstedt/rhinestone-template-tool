/**
 * Canvas coordinate conversion utilities
 * 
 * Handles conversion between:
 * - Screen coordinates (px from canvas top-left)
 * - SVG viewBox coordinates  
 * - Physical coordinates (mm)
 */

export interface CanvasTransform {
  viewBoxX: number;
  viewBoxY: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface CanvasStoneLike {
  center: { x: number; y: number };
  holeDiameterMm: number;
}

export interface CanvasWorkspaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitViewResult {
  zoom: number;
  panX: number;
  panY: number;
}

export function calculateDisplayedCanvasViewBox(
  workspace: CanvasWorkspaceBounds,
  zoom: number,
  panXmm: number,
  panYmm: number,
): CanvasWorkspaceBounds {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const width = workspace.width / safeZoom;
  const height = workspace.height / safeZoom;
  const centerX = workspace.x + workspace.width / 2 - panXmm;
  const centerY = workspace.y + workspace.height / 2 - panYmm;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

/**
 * Grows `viewBox` (about its centre) to the aspect ratio `widthOverHeight` of the element that
 * draws it, never shrinking either side. The canvas SVG uses this as its `viewBox`, so the view box
 * fills the element exactly: there are no letterbox bands, and screen ↔ mm conversion (which divides
 * by the element's size) is exact on any screen shape, including a tall phone.
 */
/**
 * Zoom limits for interactive zooming (buttons, wheel, pinch, shortcuts). The upper limit matches "fit to
 * screen", which can need a high zoom for a small design on a big canvas (a 70 mm word on a phone is ~6x).
 * Before this was shared, fit could produce a zoom above the 5x that the controls allowed, so the first
 * pinch or wheel tick snapped the view back out.
 */
export const MIN_CANVAS_ZOOM = 0.1;
export const MAX_CANVAS_ZOOM = 100;

export function expandViewBoxToAspect(
  viewBox: CanvasWorkspaceBounds,
  widthOverHeight: number,
): CanvasWorkspaceBounds {
  if (!Number.isFinite(widthOverHeight) || widthOverHeight <= 0 || viewBox.width <= 0 || viewBox.height <= 0) {
    return viewBox;
  }
  const width = Math.max(viewBox.width, viewBox.height * widthOverHeight);
  const height = width / widthOverHeight;
  return {
    x: viewBox.x + viewBox.width / 2 - width / 2,
    y: viewBox.y + viewBox.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * Convert screen coordinates (mouse event) to SVG viewBox coordinates
 */
export function screenToViewBox(
  screenX: number,
  screenY: number,
  canvas: HTMLElement | SVGSVGElement,
  transform: CanvasTransform
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const relativeX = screenX - rect.left;
  const relativeY = screenY - rect.top;

  // Convert from canvas pixels to viewBox coordinates
  const x = transform.viewBoxX + (relativeX / transform.canvasWidth) * transform.viewBoxWidth;
  const y = transform.viewBoxY + (relativeY / transform.canvasHeight) * transform.viewBoxHeight;

  return { x, y };
}

/**
 * ViewBox coordinates are in mm for our templates,
 * so this is just a pass-through with type safety
 */
export function viewBoxToMm(viewBoxX: number, viewBoxY: number): { x: number; y: number } {
  return { x: viewBoxX, y: viewBoxY };
}

/**
 * Combined conversion: screen → viewBox → mm
 */
export function screenToMm(
  screenX: number,
  screenY: number,
  canvas: HTMLElement | SVGSVGElement,
  transform: CanvasTransform
): { x: number; y: number } {
  const viewBox = screenToViewBox(screenX, screenY, canvas, transform);
  return viewBoxToMm(viewBox.x, viewBox.y);
}

/**
 * Snap coordinate to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Returns evenly spaced points along a line segment, excluding the start point.
 * Useful for drag-to-draw interactions where stones should be placed at a
 * consistent physical spacing in mm.
 */
export function interpolateLinePointsAtSpacing(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  spacingMm: number,
): Array<{ x: number; y: number }> {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) {
    return [];
  }

  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  if (distance < spacingMm) {
    return [];
  }

  const steps = Math.floor(distance / spacingMm);
  return Array.from({ length: steps }, (_, index) => {
    const t = ((index + 1) * spacingMm) / distance;
    return {
      x: startX + dx * t,
      y: startY + dy * t,
    };
  });
}

export function calculateCanvasWorkspaceBounds(
  stones: readonly CanvasStoneLike[],
  options?: {
    emptyWidthMm?: number;
    emptyHeightMm?: number;
    minWidthMm?: number;
    minHeightMm?: number;
    paddingMm?: number;
  },
): CanvasWorkspaceBounds {
  const emptyWidthMm = options?.emptyWidthMm ?? 900;
  const emptyHeightMm = options?.emptyHeightMm ?? 700;
  const minWidthMm = options?.minWidthMm ?? 900;
  const minHeightMm = options?.minHeightMm ?? 700;
  const paddingMm = options?.paddingMm ?? 40;

  if (stones.length === 0) {
    return { x: 0, y: 0, width: emptyWidthMm, height: emptyHeightMm };
  }

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

  const x = Math.min(0, minX - paddingMm);
  const y = Math.min(0, minY - paddingMm);
  const width = Math.max(minWidthMm, maxX + paddingMm - x);
  const height = Math.max(minHeightMm, maxY + paddingMm - y);

  return {
    x,
    y,
    width,
    height,
  };
}

/**
 * Keeps the design in reach. However the view is moved (wheel, drag, pinch, zoom about the cursor), the
 * centre of what is shown may not go further than `overscan` of a screen beyond the design's edges, so
 * the design can never be scrolled out of sight into empty space. Idempotent, and a view that already
 * satisfies it (such as the one "fit to screen" produces) is returned unchanged.
 */
export function clampCanvasPan(args: {
  workspace: CanvasWorkspaceBounds;
  /** Bounds of the stones, or of the workspace when there are none. */
  content: CanvasWorkspaceBounds;
  zoom: number;
  panX: number;
  panY: number;
  /** Width over height of the element that shows the view, when known. */
  aspect?: number | null;
  overscan?: number;
}): { panX: number; panY: number } {
  const { workspace, content, zoom, panX, panY, aspect = null, overscan = 0.3 } = args;
  if (![panX, panY, zoom].every(Number.isFinite)) return { panX: 0, panY: 0 };

  const base = calculateDisplayedCanvasViewBox(workspace, zoom, panX, panY);
  const shown = aspect && aspect > 0 ? expandViewBoxToAspect(base, aspect) : base;
  const centerX = shown.x + shown.width / 2;
  const centerY = shown.y + shown.height / 2;

  const clampedX = Math.min(Math.max(centerX, content.x - overscan * shown.width), content.x + content.width + overscan * shown.width);
  const clampedY = Math.min(Math.max(centerY, content.y - overscan * shown.height), content.y + content.height + overscan * shown.height);

  return {
    panX: clampedX === centerX ? panX : workspace.x + workspace.width / 2 - clampedX,
    panY: clampedY === centerY ? panY : workspace.y + workspace.height / 2 - clampedY,
  };
}

export function calculateFitViewTransform(
  workspace: CanvasWorkspaceBounds,
  content: CanvasWorkspaceBounds,
  viewport: { widthPx: number; heightPx: number },
  options?: { margin?: number; minZoom?: number; maxZoom?: number },
): FitViewResult {
  const margin = options?.margin ?? 0.92;
  const minZoom = options?.minZoom ?? 0.1;
  const maxZoom = options?.maxZoom ?? 5;
  const contentWidth = Math.max(content.width, 1e-6);
  const contentHeight = Math.max(content.height, 1e-6);
  const viewportWidth = Math.max(viewport.widthPx, 1);
  const viewportHeight = Math.max(viewport.heightPx, 1);
  const viewportAspect = viewportWidth / viewportHeight;
  const contentAspect = contentWidth / contentHeight;

  let viewBoxWidth: number;
  let viewBoxHeight: number;
  if (contentAspect >= viewportAspect) {
    viewBoxWidth = contentWidth / margin;
    viewBoxHeight = viewBoxWidth / viewportAspect;
  } else {
    viewBoxHeight = contentHeight / margin;
    viewBoxWidth = viewBoxHeight * viewportAspect;
  }

  // The canvas shows `expandViewBoxToAspect(workspace / zoom, viewportAspect)`, whose width is
  // max(workspace.width, workspace.height * aspect) / zoom. Solve for the zoom that makes it
  // exactly the width needed to hold the content.
  const exactFitZoom = Math.max(workspace.width, workspace.height * viewportAspect) / viewBoxWidth;
  const zoom = Math.min(Math.max(exactFitZoom, minZoom), maxZoom);
  const panX = workspace.x + workspace.width / 2 - (content.x + content.width / 2);
  const panY = workspace.y + workspace.height / 2 - (content.y + content.height / 2);
  return { zoom, panX, panY };
}

export function validatePersistedCanvasView(
  value: unknown,
  workspace: CanvasWorkspaceBounds,
  content: CanvasWorkspaceBounds,
): FitViewResult | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { manual?: unknown; zoom?: unknown; panX?: unknown; panY?: unknown };
  if (candidate.manual !== true) return null;
  if (
    typeof candidate.zoom !== 'number'
    || !Number.isFinite(candidate.zoom)
    || candidate.zoom < 0.1
    || candidate.zoom > 5
    || typeof candidate.panX !== 'number'
    || !Number.isFinite(candidate.panX)
    || typeof candidate.panY !== 'number'
    || !Number.isFinite(candidate.panY)
  ) {
    return null;
  }

  const viewBox = calculateDisplayedCanvasViewBox(
    workspace,
    candidate.zoom,
    candidate.panX,
    candidate.panY,
  );
  const intersects =
    content.x <= viewBox.x + viewBox.width
    && content.x + content.width >= viewBox.x
    && content.y <= viewBox.y + viewBox.height
    && content.y + content.height >= viewBox.y;
  return intersects
    ? { zoom: candidate.zoom, panX: candidate.panX, panY: candidate.panY }
    : null;
}

/**
 * Check if a point is near a stone (for hit testing)
 */
export function isPointNearStone(
  pointX: number,
  pointY: number,
  stoneX: number,
  stoneY: number,
  stoneRadiusMm: number,
  hitAreaScale: number = 2.5
): boolean {
  const dx = pointX - stoneX;
  const dy = pointY - stoneY;
  const distanceSquared = dx * dx + dy * dy;
  const hitRadius = stoneRadiusMm * hitAreaScale;
  return distanceSquared <= hitRadius * hitRadius;
}

/**
 * Maps a value in a linear span (e.g. a viewBox axis) to a 0-100% CSS position.
 * Shared by both ruler axes so tick placement can never drift from the value
 * math used elsewhere for that axis.
 */
export function mmToRulerPercent(value: number, start: number, span: number): string {
  if (span <= 0) return '0%';
  return `${((value - start) / span) * 100}%`;
}
