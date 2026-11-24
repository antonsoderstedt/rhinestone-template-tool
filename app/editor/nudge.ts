/**
 * Moving selected stones with the arrow keys: 0.5 mm a press, Shift for 5 mm, Alt for 0.1 mm. Pure.
 */

export const NUDGE_STEP_MM = 0.5;
export const NUDGE_BIG_STEP_MM = 5;
export const NUDGE_FINE_STEP_MM = 0.1;

const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

export const isNudgeKey = (key: string): boolean => key in DIRECTIONS;

export function nudgeStep(modifiers: { shift?: boolean; alt?: boolean }): number {
  if (modifiers.alt) return NUDGE_FINE_STEP_MM;
  return modifiers.shift ? NUDGE_BIG_STEP_MM : NUDGE_STEP_MM;
}

const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** The moves for one key press, or null for a key that is not an arrow or when nothing is selected. */
export function nudgeMoves(
  stones: ReadonlyArray<{ id: string; center: { x: number; y: number } }>,
  selected: ReadonlySet<string>,
  key: string,
  modifiers: { shift?: boolean; alt?: boolean } = {},
): Array<{ id: string; toX: number; toY: number }> | null {
  const direction = DIRECTIONS[key];
  if (!direction || selected.size === 0) return null;
  const step = nudgeStep(modifiers);
  const moves = stones
    .filter((stone) => selected.has(stone.id))
    .map((stone) => ({ id: stone.id, toX: round(stone.center.x + direction.dx * step), toY: round(stone.center.y + direction.dy * step) }));
  return moves.length > 0 ? moves : null;
}
