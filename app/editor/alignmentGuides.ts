/**
 * Alignment/snap-guide helpers for dragging stones on the canvas.
 *
 * Pure, DOM-free — a UI drag-assist, not engine geometry. Snaps a dragged
 * stone's center to nearby stones' x/y centers or the workspace centerline
 * within a small mm tolerance, and reports which guide line(s) fired so the
 * canvas can draw a thin dashed line for feedback.
 */

export interface SnapTargetPoint {
  x: number;
  y: number;
}

export interface SnapGuideLine {
  axis: 'x' | 'y';
  value: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuideLine[];
}

const DEFAULT_SNAP_THRESHOLD_MM = 0.5;

function closestCandidate(value: number, candidates: readonly number[], thresholdMm: number): number | null {
  let best: number | null = null;
  let bestDistance = thresholdMm;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Given a stone's candidate dragged position, snap it to nearby stones'
 * centers or the workspace centerline when within `thresholdMm`.
 */
export function findSnapCandidates(
  draggedX: number,
  draggedY: number,
  otherStones: readonly SnapTargetPoint[],
  workspaceCenter: SnapTargetPoint,
  thresholdMm: number = DEFAULT_SNAP_THRESHOLD_MM,
): SnapResult {
  const xCandidates = [workspaceCenter.x, ...otherStones.map((stone) => stone.x)];
  const yCandidates = [workspaceCenter.y, ...otherStones.map((stone) => stone.y)];

  const snappedX = closestCandidate(draggedX, xCandidates, thresholdMm);
  const snappedY = closestCandidate(draggedY, yCandidates, thresholdMm);

  const guides: SnapGuideLine[] = [];
  if (snappedX !== null) guides.push({ axis: 'x', value: snappedX });
  if (snappedY !== null) guides.push({ axis: 'y', value: snappedY });

  return {
    x: snappedX ?? draggedX,
    y: snappedY ?? draggedY,
    guides,
  };
}
