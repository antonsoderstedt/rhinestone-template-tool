import { describe, it, expect } from 'vitest';
import {
  validateSafeSvgInput,
  extractSvgElements,
  parseSvgAttributes,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAFE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">
  <line x1="0" y1="0" x2="30" y2="0" stroke="black" />
</svg>`;

// ─── validateSafeSvgInput ─────────────────────────────────────────────────────

describe('validateSafeSvgInput', () => {
  it('returns safe: true for a simple safe SVG', () => {
    const result = validateSafeSvgInput(SAFE_SVG);
    expect(result.safe).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags <script', () => {
    const r = validateSafeSvgInput('<svg><script>alert(1)</script></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.includes('<script'))).toBe(true);
  });

  it('flags <foreignObject', () => {
    const r = validateSafeSvgInput('<svg><foreignObject><div>x</div></foreignObject></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('foreignobject'))).toBe(true);
  });

  it('flags <image', () => {
    const r = validateSafeSvgInput('<svg><image href="photo.jpg" /></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.includes('<image'))).toBe(true);
  });

  it('flags javascript:', () => {
    const r = validateSafeSvgInput('<svg><a onclick="javascript:void(0)">x</a></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.includes('javascript:'))).toBe(true);
  });

  it('flags onload=', () => {
    const r = validateSafeSvgInput('<svg onload="doEvil()"><circle r="5"/></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('onload'))).toBe(true);
  });

  it('flags href= (external link)', () => {
    const r = validateSafeSvgInput('<svg><a href="http://example.com">click</a></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('href'))).toBe(true);
  });

  it('flags xlink:href=', () => {
    const r = validateSafeSvgInput('<svg><use xlink:href="#sym" /></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('href'))).toBe(true);
  });

  it('reports multiple issues when several patterns match', () => {
    const svg = '<svg onload="x()"><script>y()</script></svg>';
    const r = validateSafeSvgInput(svg);
    expect(r.safe).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── extractSvgElements ───────────────────────────────────────────────────────

describe('extractSvgElements', () => {
  it('extracts a line element', () => {
    const els = extractSvgElements('<svg><line x1="0" y1="0" x2="10" y2="5" /></svg>');
    expect(els.some((e) => e.tagName === 'line')).toBe(true);
  });

  it('extracts line attributes correctly', () => {
    const els = extractSvgElements('<svg><line x1="0" y1="0" x2="10" y2="5" /></svg>');
    const line = els.find((e) => e.tagName === 'line')!;
    expect(line.attributes.x1).toBe('0');
    expect(line.attributes.x2).toBe('10');
    expect(line.attributes.y2).toBe('5');
  });

  it('extracts a polyline element', () => {
    const els = extractSvgElements('<svg><polyline points="0,0 10,10 20,0" /></svg>');
    expect(els.some((e) => e.tagName === 'polyline')).toBe(true);
  });

  it('extracts a polygon element', () => {
    const els = extractSvgElements('<svg><polygon points="0,0 10,10 20,0" /></svg>');
    expect(els.some((e) => e.tagName === 'polygon')).toBe(true);
  });

  it('extracts a rect element', () => {
    const els = extractSvgElements('<svg><rect x="5" y="10" width="20" height="15" /></svg>');
    const rect = els.find((e) => e.tagName === 'rect')!;
    expect(rect).toBeDefined();
    expect(rect.attributes.width).toBe('20');
    expect(rect.attributes.height).toBe('15');
  });

  it('extracts a circle element', () => {
    const els = extractSvgElements('<svg><circle cx="20" cy="20" r="10" /></svg>');
    const circle = els.find((e) => e.tagName === 'circle')!;
    expect(circle).toBeDefined();
    expect(circle.attributes.r).toBe('10');
  });

  it('extracts a path element', () => {
    const els = extractSvgElements('<svg><path d="M 0 0 L 10 10 Z" /></svg>');
    const path = els.find((e) => e.tagName === 'path')!;
    expect(path).toBeDefined();
    expect(path.attributes.d).toBe('M 0 0 L 10 10 Z');
  });

  it('ignores unsupported tags (g, text, use, defs)', () => {
    const svg = '<svg><g id="group"><text>hi</text></g><use href="#x"/></svg>';
    const els = extractSvgElements(svg);
    expect(els.every((e) => !['g', 'text', 'use', 'defs'].includes(e.tagName))).toBe(true);
  });

  it('returns empty array when no supported elements found', () => {
    const els = extractSvgElements('<svg><g><text>Hello</text></g></svg>');
    expect(els).toHaveLength(0);
  });
});

// ─── parseSvgAttributes ───────────────────────────────────────────────────────

describe('parseSvgAttributes', () => {
  it('parses double-quoted attributes', () => {
    const attrs = parseSvgAttributes('cx="10" cy="20" r="5"');
    expect(attrs.cx).toBe('10');
    expect(attrs.cy).toBe('20');
    expect(attrs.r).toBe('5');
  });

  it('parses single-quoted attributes', () => {
    const attrs = parseSvgAttributes("cx='10' cy='20'");
    expect(attrs.cx).toBe('10');
    expect(attrs.cy).toBe('20');
  });

  it('lowercases attribute names', () => {
    const attrs = parseSvgAttributes('CX="10" CY="20"');
    expect(attrs.cx).toBe('10');
    expect(attrs.cy).toBe('20');
  });

  it('handles full tag string', () => {
    const attrs = parseSvgAttributes('<circle cx="10" cy="20" r="5" />');
    expect(attrs.cx).toBe('10');
    expect(attrs.r).toBe('5');
  });
});

// ─── Additional safety patterns (v2) ─────────────────────────────────────────

describe('validateSafeSvgInput — v2 safety additions', () => {
  it('flags <style tag', () => {
    const r = validateSafeSvgInput('<svg><style>rect{fill:red}</style><rect /></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('style'))).toBe(true);
  });

  it('flags data: URL', () => {
    const r = validateSafeSvgInput('<svg><image href="data:image/png;base64,abc"/></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('data:'))).toBe(true);
  });

  it('flags @import (external CSS)', () => {
    const r = validateSafeSvgInput('<svg><style>@import url("ext.css");</style></svg>');
    expect(r.safe).toBe(false);
    expect(r.issues.some((i) => i.toLowerCase().includes('@import'))).toBe(true);
  });
});
