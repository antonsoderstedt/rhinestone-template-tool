/**
 * Which stones to draw for the part of the design that is in view. Pure.
 */

/** At or below this many stones everything is drawn; culling only pays off for big designs. */
export const CULLING_THRESHOLD = 2000;

export function visibleStonesForView<T extends { id: string; center: { x: number; y: number }; holeDiameterMm: number }>(
  stones: readonly T[],
  view: { x: number; y: number; width: number; height: number },
  keepIds: ReadonlySet<string> = new Set(),
  marginFraction = 0.15,
): readonly T[] {
  if (stones.length <= CULLING_THRESHOLD) return stones;
  const mx = view.width * marginFraction;
  const my = view.height * marginFraction;
  const minX = view.x - mx;
  const maxX = view.x + view.width + mx;
  const minY = view.y - my;
  const maxY = view.y + view.height + my;
  return stones.filter((stone) => {
    if (keepIds.has(stone.id)) return true;
    const r = stone.holeDiameterMm / 2;
    return stone.center.x + r >= minX && stone.center.x - r <= maxX && stone.center.y + r >= minY && stone.center.y - r <= maxY;
  });
}
