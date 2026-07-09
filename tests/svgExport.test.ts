import { describe, it, expect } from 'vitest';
import { createBasicSvgExport } from '../src/lib/rhinestone-engine/index.js';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeStone(overrides: Partial<Stone> = {}): Stone {
  return {
    id: 'stone-1',
    center: { x: 10, y: 10 },
    stoneSize: 'SS10',
    holeDiameterMm: 3.0,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<RhinestoneTemplate> = {}): RhinestoneTemplate {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    unit: 'mm',
    stones: [makeStone()],
    ...overrides,
  };
}

// ─── Basic SVG structure ───────────────────────────────────────────────────────

describe('createBasicSvgExport — structure', () => {
  it('returns a string', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(typeof svg).toBe('string');
  });

  it('contains opening <svg tag', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('<svg');
  });

  it('contains xmlns="http://www.w3.org/2000/svg"', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains width in mm (not px)', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).not.toMatch(/width="[\d.]+px"/);
  });

  it('contains height in mm (not px)', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toMatch(/height="[\d.]+mm"/);
    expect(svg).not.toMatch(/height="[\d.]+px"/);
  });

  it('contains a viewBox attribute', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('viewBox=');
  });

  it('contains data-template-id', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('data-template-id="tpl-1"');
  });

  it('contains data-unit="mm"', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('data-unit="mm"');
  });

  it('contains data-template-name', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('data-template-name="Test Template"');
  });
});

// ─── Stone layer ──────────────────────────────────────────────────────────────

describe('createBasicSvgExport — stones layer', () => {
  it('contains <g id="stones">', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('<g id="stones">');
  });

  it('produces one <circle> per stone', () => {
    const template = makeTemplate({
      stones: [
        makeStone({ id: 's1', center: { x: 5, y: 5 } }),
        makeStone({ id: 's2', center: { x: 15, y: 5 } }),
        makeStone({ id: 's3', center: { x: 25, y: 5 } }),
      ],
    });
    const svg = createBasicSvgExport(template);
    const circleMatches = svg.match(/<circle/g);
    expect(circleMatches).toHaveLength(3);
  });

  it('circle radius equals holeDiameterMm / 2', () => {
    const stone = makeStone({ holeDiameterMm: 3.0 });
    const svg = createBasicSvgExport(makeTemplate({ stones: [stone] }));
    // r="1.5" (3.0 / 2)
    expect(svg).toContain('r="1.5"');
  });

  it('circle cx and cy match stone center', () => {
    const stone = makeStone({ center: { x: 12.5, y: 7.25 } });
    const svg = createBasicSvgExport(makeTemplate({ stones: [stone] }));
    expect(svg).toContain('cx="12.5"');
    expect(svg).toContain('cy="7.25"');
  });

  it('circle contains data-stone-id', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('data-stone-id="stone-1"');
  });

  it('circle contains data-stone-size', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('data-stone-size="SS10"');
  });

  it('circle contains data-hole-diameter-mm', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).toContain('data-hole-diameter-mm="3"');
  });
});

// ─── Guide layer ──────────────────────────────────────────────────────────────

describe('createBasicSvgExport — guide layer', () => {
  it('does not include a rect when includeGuideBox is false (default)', () => {
    const svg = createBasicSvgExport(makeTemplate(), { includeGuideBox: false });
    expect(svg).not.toContain('<rect');
  });

  it('includes a rect when includeGuideBox is true', () => {
    const svg = createBasicSvgExport(makeTemplate(), { includeGuideBox: true });
    expect(svg).toContain('<rect');
  });
});

// ─── Labels layer ─────────────────────────────────────────────────────────────

describe('createBasicSvgExport — labels layer', () => {
  it('does not include <text> when includeLabels is false (default)', () => {
    const svg = createBasicSvgExport(makeTemplate(), { includeLabels: false });
    expect(svg).not.toContain('<text');
  });

  it('includes <text> labels when includeLabels is true', () => {
    const svg = createBasicSvgExport(makeTemplate(), { includeLabels: true });
    expect(svg).toContain('<text');
  });

  it('label text contains the stone size', () => {
    const svg = createBasicSvgExport(makeTemplate(), { includeLabels: true });
    expect(svg).toContain('SS10');
  });
});

// ─── Safety rules ─────────────────────────────────────────────────────────────

describe('createBasicSvgExport — safety rules', () => {
  it('does not contain <image', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).not.toContain('<image');
  });

  it('does not contain toDataURL', () => {
    const svg = createBasicSvgExport(makeTemplate());
    expect(svg).not.toContain('toDataURL');
  });

  it('throws if template.unit is not "mm"', () => {
    // Cast to bypass TypeScript — simulates a runtime misuse
    const badTemplate = { ...makeTemplate(), unit: 'in' } as unknown as RhinestoneTemplate;
    expect(() => createBasicSvgExport(badTemplate)).toThrow(/mm/);
  });
});

// ─── XML escaping ─────────────────────────────────────────────────────────────

describe('createBasicSvgExport — XML escaping', () => {
  it('escapes & in template name', () => {
    const svg = createBasicSvgExport(makeTemplate({ name: 'Rock & Roll' }));
    expect(svg).toContain('Rock &amp; Roll');
    expect(svg).not.toContain('Rock & Roll');
  });

  it('escapes < in template name', () => {
    const svg = createBasicSvgExport(makeTemplate({ name: 'A < B' }));
    expect(svg).toContain('A &lt; B');
  });

  it('escapes > in template name', () => {
    const svg = createBasicSvgExport(makeTemplate({ name: 'A > B' }));
    expect(svg).toContain('A &gt; B');
  });

  it('escapes " in template name', () => {
    const svg = createBasicSvgExport(makeTemplate({ name: 'Say "hello"' }));
    expect(svg).toContain('Say &quot;hello&quot;');
  });

  it('escapes \' in template id', () => {
    const svg = createBasicSvgExport(makeTemplate({ id: "it's-fine" }));
    expect(svg).toContain('&apos;');
  });
});

// ─── Empty template ────────────────────────────────────────────────────────────

describe('createBasicSvgExport — empty template', () => {
  it('exports without error when stones is empty and widthMm/heightMm are set', () => {
    const template = makeTemplate({ stones: [], widthMm: 100, heightMm: 50 });
    const svg = createBasicSvgExport(template);
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="100mm"');
    expect(svg).toContain('height="50mm"');
  });

  it('stones layer is present but empty when no stones', () => {
    const template = makeTemplate({ stones: [], widthMm: 100, heightMm: 50 });
    const svg = createBasicSvgExport(template);
    expect(svg).toContain('<g id="stones">');
    expect(svg).not.toContain('<circle');
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('createBasicSvgExport — determinism', () => {
  it('produces identical output for the same input', () => {
    const template = makeTemplate();
    const opts = { paddingMm: 3, decimalPlaces: 4 };
    expect(createBasicSvgExport(template, opts)).toBe(createBasicSvgExport(template, opts));
  });
});
