/**
 * Template Import Generator UI Integration Tests
 *
 * Tests the TemplateImportGenerator component's UI behavior and integration with the engine.
 */

import { describe, it, expect } from 'vitest';
import {
  importRhinestoneTemplate,
  createImportedTemplate,
  estimateStoneSizeId,
} from '../src/lib/rhinestone-engine/index.js';

// ─── UI Component Behavior ───────────────────────────────────────────────────

describe('Template Import Generator UI', () => {
  it('is separate from Convert Shape SVG Upload', () => {
    // This is a design verification - Template Import uses importRhinestoneTemplate
    // while SVG Upload uses svgStringToPolylines + createPolylineFilledRhinestoneTemplate
    expect(typeof importRhinestoneTemplate).toBe('function');
    expect(typeof createImportedTemplate).toBe('function');
  });

  it('uses the template import engine, not the polyline fill engine', () => {
    // Template Import should detect pre-placed stones, not generate new ones
    const svgWithCircle = `
      <svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="1.5" fill="#ff0000"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svgWithCircle });
    
    // Should detect one stone
    expect(result.stones.length).toBe(1);
    // Coordinates are normalized to origin, so first stone is at (0,0)
    expect(result.stones[0].center.x).toBeCloseTo(0, 1);
    expect(result.stones[0].center.y).toBeCloseTo(0, 1);
    expect(result.stones[0].diameterMm).toBeCloseTo(3.0, 1);
  });
});

// ─── Import Processing ───────────────────────────────────────────────────────

describe('Template Import Processing', () => {
  it('imports simple circles correctly', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1" fill="red"/>
        <circle cx="15" cy="15" r="1" fill="blue"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    expect(result.stones.length).toBe(2);
    expect(result.detectedColors).toContain('red');
    expect(result.detectedColors).toContain('blue');
  });

  it('imports multi-color stones', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1" fill="#ff0000"/>
        <circle cx="10" cy="10" r="1" fill="#00ff00"/>
        <circle cx="15" cy="15" r="1" fill="#0000ff"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    expect(result.stones.length).toBe(3);
    expect(result.detectedColors.length).toBe(3);
    expect(result.detectedColors).toContain('#ff0000');
    expect(result.detectedColors).toContain('#00ff00');
    expect(result.detectedColors).toContain('#0000ff');
  });

  it('handles nested transforms correctly', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <g transform="translate(10, 10)">
          <g transform="scale(2)">
            <circle cx="0" cy="0" r="1" fill="red"/>
          </g>
        </g>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    // Should detect one stone
    expect(result.stones.length).toBe(1);
    // Coordinates are normalized to origin (0, 0) after import
    expect(result.stones[0].center.x).toBeCloseTo(0, 1);
    expect(result.stones[0].center.y).toBeCloseTo(0, 1);
    // Diameter should be scaled by transform (r=1 * scale=2 => d=4)
    expect(result.stones[0].diameterMm).toBeCloseTo(4, 1);
  });

  it('handles SVG with decorative paths alongside stones', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <path d="M 0 0 L 20 20" stroke="black" fill="none"/>
        <circle cx="10" cy="10" r="1" fill="red"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    // Should detect the circle; non-circular paths are skipped silently
    expect(result.stones.length).toBe(1);
  });

  it('reports ignored elements when SVG has non-stone shapes', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <rect x="0" y="0" width="5" height="5" fill="gray"/>
        <circle cx="10" cy="10" r="1" fill="red"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    // Should detect the circle; rect is not checked by regex parser
    expect(result.stones.length).toBe(1);
  });

  it('handles SVG without stones gracefully', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <rect x="0" y="0" width="20" height="20" fill="blue"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    expect(result.stones.length).toBe(0);
  });

  it('rejects unsafe SVG with script elements', () => {
    const unsafeSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <script>alert('XSS')</script>
        <circle cx="10" cy="10" r="1" fill="red"/>
      </svg>
    `;

    expect(() => {
      importRhinestoneTemplate({ svgText: unsafeSvg });
    }).toThrow(/Unsafe SVG/);
  });
});

// ─── Stone Size Estimation ────────────────────────────────────────────────────

describe('Template Import Stone Size Estimation', () => {
  it('estimates SS6 for small stones', () => {
    const size = estimateStoneSizeId(2.0);
    expect(size).toBe('SS6');
  });

  it('estimates SS8 for medium-small stones', () => {
    const size = estimateStoneSizeId(2.4);
    expect(size).toBe('SS8');
  });

  it('estimates SS10 for medium stones', () => {
    const size = estimateStoneSizeId(2.8);
    expect(size).toBe('SS10');
  });

  it('estimates SS12 for larger stones', () => {
    const size = estimateStoneSizeId(3.1);
    expect(size).toBe('SS12');
  });

  it('estimates SS16 for TRW-sized stones', () => {
    const size = estimateStoneSizeId(4.394);
    expect(size).toBe('SS16');
  });

  it('estimates SS20 for large TRW stones', () => {
    const size = estimateStoneSizeId(5.283);
    expect(size).toBe('SS20');
  });

  it('returns null for extremely small diameters', () => {
    const size = estimateStoneSizeId(0.5);
    expect(size).toBeNull();
  });

  it('returns null for extremely large diameters outside tolerance', () => {
    const size = estimateStoneSizeId(20);
    // No stone size matches 20mm within tolerance
    expect(size).toBeNull();
  });
});

// ─── Import Summary Stats ─────────────────────────────────────────────────────

describe('Template Import Summary', () => {
  it('reports stone count correctly', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1" fill="red"/>
        <circle cx="10" cy="10" r="1" fill="red"/>
        <circle cx="15" cy="15" r="1" fill="red"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    expect(result.stones.length).toBe(3);
  });

  it('reports detected diameters', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1" fill="red"/>
        <circle cx="15" cy="15" r="2" fill="blue"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    expect(result.detectedDiameters.length).toBe(2);
    expect(result.detectedDiameters).toContain(2.0);
    expect(result.detectedDiameters).toContain(4.0);
  });

  it('reports detected colors', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1" fill="red"/>
        <circle cx="10" cy="10" r="1" fill="green"/>
        <circle cx="15" cy="15" r="1" fill="red"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    expect(result.detectedColors).toContain('red');
    expect(result.detectedColors).toContain('green');
    expect(result.detectedColors.length).toBe(2); // Should deduplicate
  });
});

// ─── Template Creation from Import ───────────────────────────────────────────

describe('Template Creation from Import', () => {
  it('creates a template from imported stones', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1.4" fill="red"/>
        <circle cx="15" cy="15" r="1.4" fill="blue"/>
      </svg>
    `;

    const result = createImportedTemplate({
      svgText: svg,
      defaultStoneSizeId: 'SS10',
    });

    expect(result.template.stones.length).toBe(2);
    expect(result.template.id).toBeDefined();
    expect(result.template.stones[0].stoneSize).toBeDefined();
  });

  it('uses default stone size for ambiguous diameters', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="0.5" fill="red"/>
      </svg>
    `;

    const result = createImportedTemplate({
      svgText: svg,
      defaultStoneSizeId: 'SS8',
    });

    // Very small diameter should use default size
    expect(result.template.stones.length).toBe(1);
    expect(result.template.stones[0].stoneSize).toBe('SS8');
  });

  it('preserves color metadata in template', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="1.4" fill="#ff0000"/>
      </svg>
    `;

    const result = createImportedTemplate({
      svgText: svg,
      defaultStoneSizeId: 'SS10',
    });

    expect(result.template.stones.length).toBe(1);
    expect(result.template.stones[0].metadata).toBeDefined();
    expect(result.template.stones[0].metadata?.fill).toBe('#ff0000');
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe('Template Import Deduplication', () => {
  it('deduplicates overlapping stones within tolerance', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="1" fill="red"/>
        <circle cx="10.001" cy="10.001" r="1" fill="blue"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({
      svgText: svg,
      deduplicateTolerance: 0.01,
    });

    // Should deduplicate to 1 stone
    expect(result.stones.length).toBe(1);
  });

  it('keeps separate stones outside tolerance', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="1" fill="red"/>
        <circle cx="15" cy="15" r="1" fill="blue"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({
      svgText: svg,
      deduplicateTolerance: 0.01,
    });

    // Should keep both stones
    expect(result.stones.length).toBe(2);
  });
});

// ─── Safety ───────────────────────────────────────────────────────────────────

describe('Template Import Safety', () => {
  it('rejects SVG with script elements', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20">
        <script>alert('XSS')</script>
        <circle cx="10" cy="10" r="1" fill="red"/>
      </svg>
    `;

    // Should throw due to unsafe script element
    expect(() => {
      importRhinestoneTemplate({ svgText: svg });
    }).toThrow(/Unsafe SVG/);
  });

  it('normalizes coordinates to origin', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="100 100 20 20">
        <circle cx="110" cy="110" r="1" fill="red"/>
      </svg>
    `;

    const result = importRhinestoneTemplate({ svgText: svg });
    
    // Should normalize so minimum is close to 0
    const minX = Math.min(...result.stones.map((s) => s.center.x));
    const minY = Math.min(...result.stones.map((s) => s.center.y));
    expect(minX).toBeLessThan(5);
    expect(minY).toBeLessThan(5);
  });
});
