import type { EditableStone } from './EditorState';

export const BOX_SELECTION_DRAG_THRESHOLD_PX = 4;

export interface SelectionBoxMm {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function shouldStartBoxSelection(options: {
  activeTool: 'select' | 'text' | 'svg' | 'grid' | 'manual';
  button: number;
  spacePressed: boolean;
  clickedStone: boolean;
  draggingStone: boolean;
}): boolean {
  return (
    options.activeTool === 'select' &&
    options.button === 0 &&
    !options.spacePressed &&
    !options.clickedStone &&
    !options.draggingStone
  );
}

export function hasExceededBoxSelectionThreshold(
  deltaXPx: number,
  deltaYPx: number,
  thresholdPx: number = BOX_SELECTION_DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(deltaXPx, deltaYPx) >= thresholdPx;
}

export function createSelectionBoxMm(
  start: { x: number; y: number },
  current: { x: number; y: number },
): SelectionBoxMm {
  return {
    left: Math.min(start.x, current.x),
    right: Math.max(start.x, current.x),
    top: Math.min(start.y, current.y),
    bottom: Math.max(start.y, current.y),
  };
}

export function isPointInsideSelectionBox(
  point: { x: number; y: number },
  box: SelectionBoxMm,
): boolean {
  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.bottom
  );
}

export function getStoneIdsInsideSelectionBox(
  stones: readonly EditableStone[],
  start: { x: number; y: number },
  current: { x: number; y: number },
): string[] {
  const box = createSelectionBoxMm(start, current);
  return stones
    .filter((stone) => isPointInsideSelectionBox(stone.center, box))
    .map((stone) => stone.id);
}

export function applyBoxSelection(
  stones: readonly EditableStone[],
  start: { x: number; y: number },
  current: { x: number; y: number },
  existingSelection: ReadonlySet<string>,
  appendWithShift: boolean,
): Set<string> {
  const insideIds = getStoneIdsInsideSelectionBox(stones, start, current);

  if (!appendWithShift) {
    return new Set(insideIds);
  }

  const nextSelection = new Set(existingSelection);
  for (const id of insideIds) {
    if (nextSelection.has(id)) {
      nextSelection.delete(id);
    } else {
      nextSelection.add(id);
    }
  }
  return nextSelection;
}
