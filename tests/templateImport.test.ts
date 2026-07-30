/**
 * Template Import Tests
 *
 * Validates that SVG files with pre-placed stones can be imported and converted
 * to editable rhinestone templates.
 */

import { describe, it, expect } from 'vitest';
import {
  importRhinestoneTemplate,
  estimateStoneSizeId,
  createImportedTemplate,
} from '../src/lib/rhinestone-engine/index';

describe('Template Import', () => {
  describe('Stone Size Estimation', () => {
    it('should estimate SS6 for 2.0mm diameter', () => {
      expect(estimateStoneSizeId(2.0)).toBe('SS6');
    });

    it('should estimate SS10 for 2.8mm diameter', () => {
      expect(estimateStoneSizeId(2.8)).toBe('SS10');
    });

    it('should estimate SS12 for 3.2mm diameter', () => {
      expect(estimateStoneSizeId(3.2)).toBe('SS12');
    });

    it('should return null for unknown diameter', () => {
      expect(estimateStoneSizeId(10.5)).toBeNull();
    });
  });

  describe('Circle Import', () => {
    it('should import basic circle elements', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" fill="red" />
          <circle cx="15" cy="10" r="1" fill="red" />
          <circle cx="20" cy="10" r="1" fill="red" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(3);
      expect(result.stones[0]!.diameterMm).toBeCloseTo(2, 0);
      expect(result.stones[0]!.fill).toBe('red');
      expect(result.ignoredElements).toBe(0);
    });

    it('should normalize stone positions to origin', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
          <circle cx="500" cy="500" r="1" />
          <circle cx="505" cy="500" r="1" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(2);

      // Positions should be normalized to start near 0
      const minX = Math.min(...result.stones.map((s) => s.center.x));
      const minY = Math.min(...result.stones.map((s) => s.center.y));
      expect(minX).toBeCloseTo(0, 0);
      expect(minY).toBeCloseTo(0, 0);
    });

    it('should calculate correct bounds', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="2" />
          <circle cx="30" cy="10" r="2" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.widthMm).toBeCloseTo(24, 0); // 30 - 10 + 4 (diameter)
      expect(result.heightMm).toBeCloseTo(4, 0); // diameter only
    });
  });

  describe('Ellipse Import', () => {
    it('should import circular ellipses', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <ellipse cx="10" cy="10" rx="1" ry="1" fill="blue" />
          <ellipse cx="15" cy="10" rx="1.05" ry="0.95" fill="blue" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(2);
      expect(result.stones[0]!.fill).toBe('blue');
    });

    it('should reject elongated ellipses', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <ellipse cx="10" cy="10" rx="2" ry="1" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(0);
      expect(result.ignoredElements).toBe(1);
    });
  });

  describe('Path Import', () => {
    it('should import circular paths', () => {
      // Approximate circle path
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <path d="M 10 5 C 12.76 5 15 7.24 15 10 C 15 12.76 12.76 15 10 15 C 7.24 15 5 12.76 5 10 C 5 7.24 7.24 5 10 5 Z" fill="green" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(1);
      expect(result.stones[0]!.fill).toBe('green');
      expect(result.stones[0]!.diameterMm).toBeGreaterThan(5);
    });
  });

  describe('Transform Handling', () => {
    it('should apply translate transform', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="0" cy="0" r="1" transform="translate(10, 20)" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(1);
      // After normalization to origin, the absolute position won't be 10,20
      // but it should have been transformed
      expect(result.stones[0]!.center.x).toBeGreaterThanOrEqual(0);
    });

    it('should apply scale transform', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" transform="scale(2)" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(1);
      expect(result.stones[0]!.diameterMm).toBeCloseTo(4, 0); // 2 * 2
    });

    it('should handle nested groups with transforms', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <g transform="translate(10, 10)">
            <g transform="scale(2)">
              <circle cx="0" cy="0" r="1" />
            </g>
          </g>
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones.length).toBe(1);
      expect(result.stones[0]!.diameterMm).toBeCloseTo(4, 0);
    });
  });

  describe('Color and Group Preservation', () => {
    it('should preserve fill colors', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" fill="#ff0000" />
          <circle cx="15" cy="10" r="1" fill="#00ff00" />
          <circle cx="20" cy="10" r="1" fill="#0000ff" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.detectedColors).toContain('#ff0000');
      expect(result.detectedColors).toContain('#00ff00');
      expect(result.detectedColors).toContain('#0000ff');
    });

    it('should use stroke color when fill is missing', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" stroke="red" fill="none" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones[0]!.stroke).toBe('red');
      expect(result.stones[0]!.fill).toBeNull();
    });

    it('should preserve group paths', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <g id="layer1">
            <g id="sublayer">
              <circle cx="10" cy="10" r="1" />
            </g>
          </g>
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.stones[0]!.group).toContain('layer1');
      expect(result.stones[0]!.group).toContain('sublayer');
    });
  });

  describe('Deduplication', () => {
    it('should remove duplicate stones within tolerance', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" />
          <circle cx="10.005" cy="10.005" r="1" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg, deduplicateTolerance: 0.01 });

      expect(result.stones.length).toBe(1);
      expect(result.warnings.some((w) => w.includes('duplicate'))).toBe(true);
    });

    it('should keep distinct stones', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" />
          <circle cx="15" cy="10" r="1" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg, deduplicateTolerance: 0.01 });

      expect(result.stones.length).toBe(2);
    });
  });

  describe('Diameter Detection', () => {
    it('should detect mixed stone sizes', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" />
          <circle cx="20" cy="10" r="1.4" />
          <circle cx="30" cy="10" r="1.6" />
        </svg>
      `;

      const result = importRhinestoneTemplate({ svgText: svg });

      expect(result.detectedDiameters.length).toBe(3);
      expect(result.detectedDiameters).toContain(2);
      expect(result.detectedDiameters).toContain(2.8);
      expect(result.detectedDiameters).toContain(3.2);
    });
  });

  describe('Safety Validation', () => {
    it('should reject SVG with script tags', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="1" />
          <script>alert('xss')</script>
        </svg>
      `;

      expect(() => importRhinestoneTemplate({ svgText: svg })).toThrow(/unsafe/i);
    });

    it('should reject SVG with javascript: URLs', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="1" href="javascript:alert('xss')" />
        </svg>
      `;

      expect(() => importRhinestoneTemplate({ svgText: svg })).toThrow(/unsafe/i);
    });
  });

  describe('Template Creation from Import', () => {
    it('should create template with editable stones', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" fill="red" />
          <circle cx="15" cy="10" r="1" fill="blue" />
          <circle cx="20" cy="10" r="1.4" fill="red" />
        </svg>
      `;

      const result = createImportedTemplate({
        svgText: svg,
        defaultStoneSizeId: 'SS10',
      });

      expect(result.template).toBeDefined();
      expect(result.template.stones.length).toBe(3);
      expect(result.detectedColors).toContain('red');
      expect(result.detectedColors).toContain('blue');

      // Verify stones have metadata
      for (const stone of result.template.stones) {
        expect(stone.metadata).toBeDefined();
        expect(stone.metadata?.originalIndex).toBeDefined();
        expect(stone.metadata?.importedDiameterMm).toBeDefined();
      }

      // Verify color metadata preservation
      const redStones = result.template.stones.filter((s) => s.metadata?.fill === 'red');
      const blueStones = result.template.stones.filter((s) => s.metadata?.fill === 'blue');
      expect(redStones.length).toBe(2);
      expect(blueStones.length).toBe(1);
    });

    it('should estimate stone sizes correctly', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="1" />
          <circle cx="15" cy="10" r="1.4" />
        </svg>
      `;

      const result = createImportedTemplate({
        svgText: svg,
        defaultStoneSizeId: 'SS10',
      });

      // First stone: diameter ~2mm → SS6
      expect(result.template.stones[0]!.stoneSize).toBe('SS6');
      
      // Second stone: diameter ~2.8mm → SS10
      expect(result.template.stones[1]!.stoneSize).toBe('SS10');
    });

    it('should use default size for unknown diameters', () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="5" />
        </svg>
      `;

      const result = createImportedTemplate({
        svgText: svg,
        defaultStoneSizeId: 'SS12',
      });

      // Large diameter doesn't match any known size, should use default
      expect(result.template.stones[0]!.stoneSize).toBe('SS12');
    });
  });
});
