import { describe, expect, it } from 'vitest';
import type { EditableStone } from '../app/editor/EditorState';
import { screenToMm } from '../app/editor/canvasCoordinates';
import {
  applyBoxSelection,
  BOX_SELECTION_DRAG_THRESHOLD_PX,
  getStoneIdsInsideSelectionBox,
  hasExceededBoxSelectionThreshold,
  shouldStartBoxSelection,
} from '../app/editor/selectionBox';

function makeStone(id: string, x: number, y: number): EditableStone {
  return {
    id,
    center: { x, y },
    holeDiameterMm: 3,
    stoneSize: 'SS10',
  };
}

function makeCanvasRect(left: number, top: number, width: number, height: number) {
  return {
    getBoundingClientRect: () => ({ left, top, width, height }),
  } as unknown as SVGSVGElement;
}

describe('selectionBox', () => {
  const stones = [
    makeStone('a', 10, 10),
    makeStone('b', 25, 25),
    makeStone('c', 45, 45),
    makeStone('d', 80, 80),
  ];

  it('selects stones from top-left to bottom-right', () => {
    expect(getStoneIdsInsideSelectionBox(stones, { x: 0, y: 0 }, { x: 40, y: 40 })).toEqual(['a', 'b']);
  });

  it('selects stones from bottom-right to top-left', () => {
    expect(getStoneIdsInsideSelectionBox(stones, { x: 40, y: 40 }, { x: 0, y: 0 })).toEqual(['a', 'b']);
  });

  it('selects only stones whose centers are inside the rectangle', () => {
    expect(getStoneIdsInsideSelectionBox(stones, { x: 0, y: 0 }, { x: 30, y: 30 })).toEqual(['a', 'b']);
    expect(getStoneIdsInsideSelectionBox(stones, { x: 0, y: 0 }, { x: 24.9, y: 24.9 })).toEqual(['a']);
  });

  it('toggles selection for Shift + box to stay consistent with Shift-click', () => {
    const result = applyBoxSelection(stones, { x: 0, y: 0 }, { x: 50, y: 50 }, new Set(['a', 'd']), true);
    expect([...result].sort()).toEqual(['b', 'c', 'd']);
  });

  it('replaces selection without Shift', () => {
    const result = applyBoxSelection(stones, { x: 0, y: 0 }, { x: 50, y: 50 }, new Set(['d']), false);
    expect([...result]).toEqual(['a', 'b', 'c']);
  });

  it('uses a movement threshold to prevent accidental box selection', () => {
    expect(hasExceededBoxSelectionThreshold(1, 1)).toBe(false);
    expect(hasExceededBoxSelectionThreshold(BOX_SELECTION_DRAG_THRESHOLD_PX, 0)).toBe(true);
  });

  it('maps a selection box correctly after zoom', () => {
    const canvas = makeCanvasRect(0, 0, 200, 200);
    const transform = {
      viewBoxX: 0,
      viewBoxY: 0,
      viewBoxWidth: 100,
      viewBoxHeight: 100,
      canvasWidth: 200,
      canvasHeight: 200,
    };

    const start = screenToMm(20, 20, canvas, transform);
    const end = screenToMm(80, 80, canvas, transform);
    expect(getStoneIdsInsideSelectionBox(stones, start, end)).toEqual(['a', 'b']);
  });

  it('maps a selection box correctly after pan', () => {
    const canvas = makeCanvasRect(100, 50, 200, 200);
    const transform = {
      viewBoxX: 0,
      viewBoxY: 0,
      viewBoxWidth: 100,
      viewBoxHeight: 100,
      canvasWidth: 200,
      canvasHeight: 200,
    };

    const start = screenToMm(120, 70, canvas, transform);
    const end = screenToMm(180, 130, canvas, transform);
    expect(getStoneIdsInsideSelectionBox(stones, start, end)).toEqual(['a', 'b']);
  });

  it('treats a click without drag as below threshold', () => {
    expect(hasExceededBoxSelectionThreshold(0, 0)).toBe(false);
    expect(hasExceededBoxSelectionThreshold(2, 2)).toBe(false);
  });

  it('does not start box selection during Space-pan', () => {
    expect(
      shouldStartBoxSelection({
        activeTool: 'select',
        button: 0,
        spacePressed: true,
        clickedStone: false,
        draggingStone: false,
      }),
    ).toBe(false);
  });

  it('does not start box selection during middle-mouse pan', () => {
    expect(
      shouldStartBoxSelection({
        activeTool: 'select',
        button: 1,
        spacePressed: false,
        clickedStone: false,
        draggingStone: false,
      }),
    ).toBe(false);
  });

  it('does not start box selection when dragging a stone or pressing on a stone', () => {
    expect(
      shouldStartBoxSelection({
        activeTool: 'select',
        button: 0,
        spacePressed: false,
        clickedStone: true,
        draggingStone: false,
      }),
    ).toBe(false);
    expect(
      shouldStartBoxSelection({
        activeTool: 'select',
        button: 0,
        spacePressed: false,
        clickedStone: false,
        draggingStone: true,
      }),
    ).toBe(false);
  });
});
