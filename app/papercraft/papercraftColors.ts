/** One colour per part, shared by the 3D model and the pattern so a part is easy to find in both. */
export function partHue(partId: number): number {
  return (partId * 137.508) % 360;
}

export function partColor(partId: number, lightness = 62): string {
  return `hsl(${partHue(partId).toFixed(1)}, 55%, ${lightness}%)`;
}
