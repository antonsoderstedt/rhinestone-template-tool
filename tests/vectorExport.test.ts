import { describe, expect, it } from 'vitest';
import { createDxfExport, createEpsExport, createRhinestoneTemplate } from '../src/lib/rhinestone-engine/index';

const stone = (id: string, x: number, y: number, hole = 3.43) => ({ id, center: { x, y }, stoneSize: 'SS10' as const, holeDiameterMm: hole });
const template = createRhinestoneTemplate({ id: 't', name: 'My design', stones: [stone('b', 30, 20), stone('a', 10, 10)] });

describe('DXF export (plan D1)', () => {
  const dxf = createDxfExport(template);
  const pairs = dxf.trim().split('\n');

  it('has one CIRCLE per stone and ends properly', () => {
    expect(pairs.filter((l, i) => l === 'CIRCLE' && pairs[i - 1] === '0')).toHaveLength(2);
    expect(pairs.slice(-2)).toEqual(['0', 'EOF']);
    expect(dxf).toContain('$INSUNITS');
  });

  it('uses millimetres, flips y so the design is the right way up, and keeps the radius', () => {
    // Stone 'a' is at the top of the design (y 10), so in DXF it has the larger y.
    const circles = [...dxf.matchAll(/CIRCLE\n8\nSTONES\n10\n([\d.-]+)\n20\n([\d.-]+)\n30\n0\n40\n([\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]) }));
    expect(circles).toHaveLength(2);
    const top = circles[0]!;
    const bottom = circles[1]!;
    expect(top.y).toBeGreaterThan(bottom.y);
    expect(top.r).toBeCloseTo(1.715, 3);
    expect(bottom.x - top.x).toBeCloseTo(20, 3);
    expect(top.y - bottom.y).toBeCloseTo(10, 3);
  });

  it('is deterministic whatever order the stones come in', () => {
    const reversed = createRhinestoneTemplate({ id: 't', name: 'My design', stones: [stone('a', 10, 10), stone('b', 30, 20)] });
    expect(createDxfExport(reversed)).toBe(dxf);
  });
});

describe('EPS export (plan D1)', () => {
  const eps = createEpsExport(template);

  it('has a bounding box in points and one arc per stone, and no image data', () => {
    expect(eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0')).toBe(true);
    expect(eps.match(/ 0 360 arc stroke/g)).toHaveLength(2);
    expect(eps).not.toMatch(/image|colorimage|readhexstring/);
    const box = /%%BoundingBox: 0 0 (\d+) (\d+)/.exec(eps)!;
    // 23.43 mm wide, 13.43 mm tall: about 66.4 x 38.1 points, rounded up.
    expect(Number(box[1])).toBe(67);
    expect(Number(box[2])).toBe(39);
  });

  it('is deterministic and refuses a template that is not in millimetres', () => {
    expect(createEpsExport(template)).toBe(eps);
    expect(() => createEpsExport({ ...template, unit: 'in' } as never)).toThrow(/mm/);
    expect(() => createDxfExport({ ...template, unit: 'in' } as never)).toThrow(/mm/);
  });

  it('handles an empty design', () => {
    const empty = createRhinestoneTemplate({ id: 'e', name: 'e', stones: [], widthMm: 20, heightMm: 10 });
    expect(createEpsExport(empty)).toContain('%%BoundingBox: 0 0 57 29');
    expect(createDxfExport(empty)).not.toContain('CIRCLE');
  });
});
