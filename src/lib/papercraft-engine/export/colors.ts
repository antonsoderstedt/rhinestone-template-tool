/** One colour per part, shared by the 3D view, the pattern and the PDF cover so a part is easy to find everywhere. */
export function partHue(partId: number): number {
  return (partId * 137.508) % 360;
}

/** The part colour as red, green and blue between 0 and 1 (saturation 55 %, lightness in percent). */
export function partRgb(partId: number, lightness = 62): [number, number, number] {
  const h = partHue(partId) / 360;
  const s = 0.55;
  const l = lightness / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (tt: number) => {
    let t = tt;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}
