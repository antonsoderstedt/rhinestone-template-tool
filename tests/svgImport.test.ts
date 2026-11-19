import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnsafeSvgContent, importSvgArtwork } from '../src/lib/rhinestone-engine/svg/svgImport';
import { svgStringToPolylines } from '../src/lib/rhinestone-engine/svg/svgToPolyline';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures/artwork', name), 'utf8');
const svg = (body: string, attrs = 'viewBox="0 0 200 200"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
const bounds = (shape: { polylines: { points: { x: number; y: number }[] }[] }) => {
  const xs = shape.polylines.flatMap((p) => p.points.map((pt) => pt.x));
  const ys = shape.polylines.flatMap((p) => p.points.map((pt) => pt.y));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

describe('groups and transforms', () => {
  it('applies the transform of every enclosing group, innermost last', () => {
    const r = importSvgArtwork(svg('<g transform="translate(100,0)"><g transform="scale(2)"><rect x="5" y="5" width="10" height="10"/></g></g>'));
    expect(bounds(r.shapes[0]!)).toEqual({ minX: 110, maxX: 130, minY: 10, maxY: 30 });
  });

  it('reads the real group-transform fixture: three shapes in three places', () => {
    const r = importSvgArtwork(fixture('synthetic/group-transform.svg'));
    expect(r.shapes).toHaveLength(3);
    expect(bounds(r.shapes[1]!).minX).toBeCloseTo(210, 1); // circle moved by translate(200,0)
    expect(bounds(r.shapes[2]!)).toMatchObject({ minX: 110, maxX: 150 }); // scale(0.5) then translate(110,10)
  });

  it('rotate about a point and the transform order of one list', () => {
    const r = importSvgArtwork(svg('<line x1="10" y1="0" x2="20" y2="0" transform="rotate(90 10 0) translate(0 0)"/>'));
    const pts = r.shapes[0]!.polylines[0]!.points;
    expect(pts[0]!.x).toBeCloseTo(10, 6);
    expect(pts[0]!.y).toBeCloseTo(0, 6);
    expect(pts[1]!.x).toBeCloseTo(10, 6);
    expect(pts[1]!.y).toBeCloseTo(10, 6);
  });
});

describe('use and defs', () => {
  it('draws a shape in defs once for each <use>, in the right place', () => {
    const r = importSvgArtwork(fixture('synthetic/use-symbol.svg'));
    expect(r.shapes).toHaveLength(3);
    expect(bounds(r.shapes[0]!).minX).toBeCloseTo(5, 1);
    expect(bounds(r.shapes[1]!).minX).toBeCloseTo(105, 1);
    expect(bounds(r.shapes[2]!).minX).toBeCloseTo(205, 1);
  });

  it('does not draw things that are only defined in defs', () => {
    expect(importSvgArtwork(svg('<defs><rect id="a" width="10" height="10"/></defs><circle cx="50" cy="50" r="10"/>')).shapes).toHaveLength(1);
  });

  it('survives a <use> that points at itself', () => {
    const r = importSvgArtwork(svg('<g id="loop"><use href="#loop"/><rect width="10" height="10"/></g>'));
    expect(r.shapes.length).toBeGreaterThan(0);
    expect(r.shapes.length).toBeLessThanOrEqual(5001);
  });
});

describe('styles', () => {
  it('takes fill from CSS classes, so a stylesheet-coloured file keeps its colours', () => {
    const r = importSvgArtwork(fixture('synthetic/style-classes.svg'));
    expect(r.shapes.map((s) => s.fill)).toEqual(['#8a7cf5', '#8a7cf5']); // the fill:none rectangle is invisible
  });

  it('applies the cascade: attribute < class < id < inline style', () => {
    const r = importSvgArtwork(svg('<style>.a{fill:#00ff00}#b{fill:#0000ff}</style><rect class="a" fill="#ff0000" width="9" height="9"/><rect id="b" class="a" width="9" height="9"/><rect id="b" style="fill:#123456" width="9" height="9"/>'));
    expect(r.shapes.map((s) => s.fill)).toEqual(['#00ff00', '#0000ff', '#123456']);
  });

  it('inherits fill from the group and multiplies opacity down the tree', () => {
    const r = importSvgArtwork(svg('<g fill="#ffaef0" opacity="0.5"><g opacity="0.5"><circle cx="9" cy="9" r="5"/></g></g>'));
    expect(r.shapes[0]!.fill).toBe('#ffaef0');
    expect(r.shapes[0]!.opacity).toBeCloseTo(0.25, 6);
  });

  it('skips hidden elements: display none, visibility hidden, opacity 0 and shapes with neither fill nor stroke', () => {
    const r = importSvgArtwork(fixture('synthetic/hidden-elements.svg'));
    expect(r.shapes).toHaveLength(1);
    expect(importSvgArtwork(svg('<rect width="10" height="10" fill="none"/>')).shapes).toHaveLength(0);
  });

  it('records fill-rule and reads rgb(), #rgb and names', () => {
    const r = importSvgArtwork(svg('<path fill-rule="evenodd" fill="rgb(255,0,128)" d="M0 0h10v10z"/><rect fill="#f0a" width="5" height="5"/><rect fill="white" width="5" height="5"/>'));
    expect(r.shapes[0]).toMatchObject({ fill: '#ff0080', fillRule: 'evenodd' });
    expect(r.shapes[1]!.fill).toBe('#ff00aa');
    expect(r.shapes[2]!.fill).toBe('#ffffff');
  });

  it('keeps stroke colour and width (scaled by the transform) for stroke-only shapes', () => {
    const r = importSvgArtwork(svg('<g transform="scale(2)"><path d="M0 0L50 0" fill="none" stroke="#000" stroke-width="5"/></g>'));
    expect(r.shapes[0]).toMatchObject({ fill: null, stroke: '#000000' });
    expect(r.shapes[0]!.strokeWidth).toBeCloseTo(10, 6);
  });
});

describe('paths', () => {
  it('reads arcs, including flags written without separators, and closes where it started', () => {
    const r = importSvgArtwork(svg('<path d="M10 50a40 40 0 1 0 80 0a40 40 0 1 0 -80 0z"/>'));
    const b = bounds(r.shapes[0]!);
    expect(b.minX).toBeCloseTo(10, 1);
    expect(b.maxX).toBeCloseTo(90, 1);
    expect(b.minY).toBeCloseTo(10, 1);
    expect(b.maxY).toBeCloseTo(90, 1);
    expect(importSvgArtwork(svg('<path d="M0 0a5 5 0 1050 0"/>')).shapes[0]!.polylines[0]!.points.at(-1)!.x).toBeCloseTo(50, 3);
  });

  it('reads the arc fixtures (rounded corners and an even-odd ring)', () => {
    const r = importSvgArtwork(fixture('synthetic/arc-badge.svg'));
    expect(r.shapes.length).toBe(2);
    expect(r.shapes[0]!.fillRule).toBe('evenodd');
    expect(r.shapes[0]!.polylines).toHaveLength(2);
  });

  it('treats extra coordinate pairs after M as line-tos and starts the next subpath after z', () => {
    const r = importSvgArtwork(svg('<path d="M0 0 10 0 10 10z l5 5 5 0"/>'));
    const [first, second] = r.shapes[0]!.polylines;
    expect(first).toMatchObject({ closed: true });
    expect(first!.points).toHaveLength(3);
    expect(second!.points[0]).toEqual({ x: 0, y: 0 });
    expect(second!.points[2]).toEqual({ x: 10, y: 5 });
  });

  it('drops the duplicate point when a closed path repeats its start', () => {
    const r = importSvgArtwork(svg('<path d="M0 0 10 0 10 10 0 0z"/>'));
    expect(r.shapes[0]!.polylines[0]!.points).toHaveLength(3);
  });

  it('rounds the corners of a rect with rx', () => {
    const r = importSvgArtwork(svg('<rect width="100" height="50" rx="10"/>'));
    expect(r.shapes[0]!.polylines[0]!.points.length).toBeGreaterThan(20);
    expect(bounds(r.shapes[0]!)).toMatchObject({ minX: 0, maxX: 100, minY: 0, maxY: 50 });
  });
});

describe('size', () => {
  it('reads width and height with units', () => {
    const r = importSvgArtwork(fixture('synthetic/size-in-mm.svg'));
    expect(r.naturalSizeMm!.widthMm).toBeCloseTo(80, 6);
    expect(r.naturalSizeMm!.heightMm).toBeCloseTo(40, 6);
    expect(r.userUnitMm).toBeCloseTo(0.1, 6);
  });

  it('falls back to the viewBox at 96 dpi, and to nothing when there is neither', () => {
    expect(importSvgArtwork(svg('<rect width="1" height="1"/>', 'viewBox="0 0 96 48"')).naturalSizeMm).toEqual({ widthMm: 25.4, heightMm: 12.7 });
    expect(importSvgArtwork('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>').naturalSizeMm).toBeNull();
  });
});

describe('what it refuses and what it says', () => {
  it('refuses scripts, event handlers, embedded images, entities, data URLs and outside links', () => {
    for (const bad of [
      '<script>alert(1)</script>',
      '<rect width="5" height="5" onclick="x()"/>',
      '<image href="a.png"/>',
      '<use href="https://evil.example/x.svg#a"/>',
      '<rect fill="url(http://x/y)" width="5" height="5"/>',
      '<rect style="fill:url(data:image/png;base64,AAA)" width="5" height="5"/>',
    ]) {
      expect(findUnsafeSvgContent(svg(bad)).length, bad).toBeGreaterThan(0);
      expect(() => importSvgArtwork(svg(bad))).toThrow(/unsafe/i);
    }
    expect(() => importSvgArtwork('<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>')).toThrow(/unsafe/i);
  });

  it('accepts local references and <style>', () => {
    expect(findUnsafeSvgContent(svg('<defs><style>.a{fill:red}</style><linearGradient id="g"/></defs><rect fill="url(#g)" width="5" height="5"/><use href="#x"/>'))).toEqual([]);
  });

  it('explains a file that only has text', () => {
    const r = importSvgArtwork(fixture('synthetic/text-element.svg'));
    expect(r.shapes).toHaveLength(0);
    expect(r.warnings.join(' ')).toMatch(/Create Outlines/);
    expect(() => svgStringToPolylines(fixture('synthetic/text-element.svg'))).toThrow(/no supported svg shapes.*outlines/i);
  });

  it('warns about gradients and selectors it does not read, and refuses a non-SVG', () => {
    const r = importSvgArtwork(svg('<defs><style>g > .a{fill:red}</style><linearGradient id="g"/></defs><rect fill="url(#g)" width="5" height="5"/>'));
    expect(r.warnings.join(' ')).toMatch(/Gradient/);
    expect(r.warnings.join(' ')).toMatch(/selector/);
    expect(() => importSvgArtwork('<html></html>')).toThrow(/not an svg/i);
  });
});

describe('the owner’s real logos', () => {
  it('reads the wordmark (CSS class fill, compound paths) as pink shapes', () => {
    const r = importSvgArtwork(fixture('smooch-wordmark.svg'));
    expect(r.shapes).toHaveLength(6);
    expect(new Set(r.shapes.map((s) => s.fill))).toEqual(new Set(['#ffaef0']));
    expect(r.naturalSizeMm!.widthMm).toBeCloseTo((597.29 * 25.4) / 96, 3);
  });

  it('reads the lips (a group, one compound path with a hole)', () => {
    const r = importSvgArtwork(fixture('smooch-lips.svg'));
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]!.polylines).toHaveLength(2);
    expect(r.shapes[0]!.fill).toBe('#000000');
  });
});
