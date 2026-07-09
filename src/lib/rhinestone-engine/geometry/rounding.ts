/**
 * Rounds a millimeter value to a fixed number of decimal places.
 *
 * Uses the "round half away from zero" strategy via Number.toFixed, which
 * is deterministic for any given input. Suitable for SVG coordinate output.
 *
 * @param value     The value to round (mm).
 * @param decimals  Number of decimal places. Default 3.
 */
export function roundMm(value: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
