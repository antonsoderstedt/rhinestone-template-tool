import type { Vec2 } from '../types';
import type { PageDrawing } from './render';

/**
 * One page as a DXF (AutoCAD release 12, ASCII) in millimetres, for Silhouette Studio and other cutting software. y points up, as in the drawing.
 * Three layers, each with its own colour so the software can give each its own cut setting: `CUT` (black), `SCORE` (red: the fold lines and tab
 * lines) and `NUMBERS` (blue: the edge numbers as lines). Closed outlines are closed polylines, everything else is a line or an open polyline.
 * No dates, no handles: the same drawing always gives the same text.
 */

const LAYERS = [
  { name: 'CUT', colour: 7 },
  { name: 'SCORE', colour: 1 },
  { name: 'NUMBERS', colour: 5 },
] as const;

type LayerName = (typeof LAYERS)[number]['name'];

const num = (n: number): string => {
  const s = (Math.round(n * 10000) / 10000).toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};

export function exportPageDxf(drawing: PageDrawing): string {
  const out: string[] = [];
  const pair = (code: number, value: string | number) => {
    out.push(String(code), String(value));
  };
  const section = (name: string, body: () => void) => {
    pair(0, 'SECTION');
    pair(2, name);
    body();
    pair(0, 'ENDSEC');
  };

  section('HEADER', () => {
    pair(9, '$ACADVER');
    pair(1, 'AC1009');
    // Millimetres: 4 for $INSUNITS, and 1 (metric) for $MEASUREMENT.
    pair(9, '$INSUNITS');
    pair(70, 4);
    pair(9, '$MEASUREMENT');
    pair(70, 1);
  });

  section('TABLES', () => {
    pair(0, 'TABLE');
    pair(2, 'LTYPE');
    pair(70, 1);
    pair(0, 'LTYPE');
    pair(2, 'CONTINUOUS');
    pair(70, 0);
    pair(3, 'Solid line');
    pair(72, 65);
    pair(73, 0);
    pair(40, 0);
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'LAYER');
    pair(70, LAYERS.length);
    for (const layer of LAYERS) {
      pair(0, 'LAYER');
      pair(2, layer.name);
      pair(70, 0);
      pair(62, layer.colour);
      pair(6, 'CONTINUOUS');
    }
    pair(0, 'ENDTAB');
  });

  const line = (layer: LayerName, a: Vec2, b: Vec2) => {
    pair(0, 'LINE');
    pair(8, layer);
    pair(10, num(a[0]));
    pair(20, num(a[1]));
    pair(30, 0);
    pair(11, num(b[0]));
    pair(21, num(b[1]));
    pair(31, 0);
  };
  const polyline = (layer: LayerName, points: readonly Vec2[], closed: boolean) => {
    if (points.length < 2) return;
    pair(0, 'POLYLINE');
    pair(8, layer);
    pair(66, 1);
    pair(70, closed ? 1 : 0);
    for (const p of points) {
      pair(0, 'VERTEX');
      pair(8, layer);
      pair(10, num(p[0]));
      pair(20, num(p[1]));
      pair(30, 0);
    }
    pair(0, 'SEQEND');
    pair(8, layer);
  };

  section('ENTITIES', () => {
    for (const c of drawing.cut) polyline('CUT', c.points, c.closed);
    for (const f of drawing.folds) if (f.kind !== 'flat') line('SCORE', f.a, f.b);
    for (const t of drawing.text) polyline('NUMBERS', t, false);
  });

  pair(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
