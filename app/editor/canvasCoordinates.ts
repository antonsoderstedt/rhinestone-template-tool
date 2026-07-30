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
 * Check if a point is near a stone (for hit testing)
 */
export function isPointNearStone(
  pointX: number,
  pointY: number,
  stoneX: number,
  stoneY: number,
  stoneRadiusMm: number,
  hitAreaScale: number = 1.5
): boolean {
  const dx = pointX - stoneX;
  const dy = pointY - stoneY;
  const distanceSquared = dx * dx + dy * dy;
  const hitRadius = stoneRadiusMm * hitAreaScale;
  return distanceSquared <= hitRadius * hitRadius;
}
