'use client';

import { AB_COLOUR, gemShades, stoneColourOf } from '../stoneColours';
import { EditableStone } from '../EditorState';

/** Width of the line drawn around a stone, in mm. The line sits inside the hole so the picture is to scale. */
export const STONE_STROKE_MM = 0.22;

export const RULER_BAND_PX = 32;

export const RULER_NICE_STEPS_MM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export const RULER_TARGET_LABEL_COUNT = 14;

export const SELECTION_MEASURE_OFFSET_MM = 18;

export const FIT_TO_SCREEN_PADDING_MM = 20;

export const FIT_TO_SCREEN_MARGIN = 0.92;

// Rounds up to a "nice" 1/2/5 step so ruler ticks/labels never crowd together at low zoom.
export function pickNiceRulerStep(rawStepMm: number): number {
  for (const step of RULER_NICE_STEPS_MM) {
    if (step >= rawStepMm) return step;
  }
  return RULER_NICE_STEPS_MM[RULER_NICE_STEPS_MM.length - 1];
}

export function buildRulerTickValues(start: number, end: number, stepMm: number): number[] {
  const first = Math.ceil(start / stepMm) * stepMm;
  const ticks: number[] = [];
  for (let value = first; value <= end; value += stepMm) {
    ticks.push(value);
  }
  return ticks;
}

/** `M x y L x y … Z` for one polyline. */
export function polylineToPathData(polyline: { points: ReadonlyArray<{ x: number; y: number }>; closed?: boolean }): string {
  if (polyline.points.length === 0) return '';
  const [first, ...rest] = polyline.points;
  return `M${first!.x.toFixed(2)} ${first!.y.toFixed(2)}${rest.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}${polyline.closed ? 'Z' : ''}`;
}

export const gemId = (hex: string) => `gem-${hex.replace('#', '').toLowerCase()}`;

/** The gradient a shiny stone of this colour is filled with: a highlight up and to the left, the colour, a darker rim. */
export function GemGradient({ hex }: { hex: string }) {
  if (hex.toLowerCase() === AB_COLOUR) {
    return (
      <radialGradient id={gemId(hex)} cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.3" stopColor="#f7d9ff" />
        <stop offset="0.55" stopColor="#b9d9ff" />
        <stop offset="0.8" stopColor="#c4f2e0" />
        <stop offset="1" stopColor="#9a8ad6" />
      </radialGradient>
    );
  }
  const shades = gemShades(hex);
  return (
    <radialGradient id={gemId(hex)} cx="0.38" cy="0.32" r="0.8">
      <stop offset="0" stopColor={shades.highlight} />
      <stop offset="0.4" stopColor={shades.body} />
      <stop offset="1" stopColor={shades.rim} />
    </radialGradient>
  );
}

export function getStoneCanvasColor(stone: EditableStone, showStoneColours: boolean): string {
  if (showStoneColours) {
    const colour = stoneColourOf(stone);
    if (colour) return colour;
  }
  if (typeof stone.metadata?.fill === 'string') return stone.metadata.fill;
  if (typeof stone.metadata?.stroke === 'string') return stone.metadata.stroke;
  return '#8b5cf6';
}
