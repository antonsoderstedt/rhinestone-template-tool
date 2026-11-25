import { partHue } from '@/src/lib/papercraft-engine';

/** One colour per part, shared by the 3D model, the pattern and the PDF cover so a part is easy to find in all of them. */
export { partHue };

export function partColor(partId: number, lightness = 62): string {
  return `hsl(${partHue(partId).toFixed(1)}, 55%, ${lightness}%)`;
}
