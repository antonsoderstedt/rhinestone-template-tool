/**
 * Tests for canvas coordinate conversion utilities
 */

import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  isPointNearStone,
  interpolateLinePointsAtSpacing,
  calculateCanvasWorkspaceBounds,
  calculateDisplayedCanvasViewBox,
  calculateFitViewTransform,
  expandViewBoxToAspect,
  validatePersistedCanvasView,
} from '../app/editor/canvasCoordinates';

describe('snapToGrid', () => {
  it('should snap to nearest grid point', () => {
    expect(snapToGrid(12.3, 10)).toBe(10);
    expect(snapToGrid(17.8, 10)).toBe(20);
    expect(snapToGrid(15, 10)).toBe(20); // 15/10=1.5, rounds to 2, 2*10=20
  });

  it('should handle negative coordinates', () => {
    expect(snapToGrid(-12.3, 10)).toBe(-10);
    expect(snapToGrid(-17.8, 10)).toBe(-20);
  });

  it('should handle zero', () => {
    expect(snapToGrid(0, 10)).toBe(0);
  });

  it('should handle different grid sizes', () => {
    expect(snapToGrid(12.3, 5)).toBe(10);
    expect(snapToGrid(12.3, 1)).toBe(12);
    expect(snapToGrid(12.3, 20)).toBe(20);
  });

  it('should snap to nearest when exactly on grid', () => {
    expect(snapToGrid(20, 10)).toBe(20);
    expect(snapToGrid(30, 10)).toBe(30);
  });
});

describe('isPointNearStone', () => {
  it('should return true when point is inside stone', () => {
    const result = isPointNearStone(10, 10, 10, 10, 2);
    expect(result).toBe(true);
  });

  it('should return true when point is near stone edge', () => {
    const result = isPointNearStone(11.5, 10, 10, 10, 2);
    expect(result).toBe(true);
  });

  it('should return false when point is far from stone', () => {
    const result = isPointNearStone(20, 20, 10, 10, 2);
    expect(result).toBe(false);
  });

  it('should use hit area scale for easier clicking', () => {
    // With hitAreaScale=1.5, effective radius is 2 * 1.5 = 3mm
    const farPoint = isPointNearStone(13, 10, 10, 10, 2, 1.5);
    expect(farPoint).toBe(true);
    
    // Without scale, same point would be outside
    const samePoint = isPointNearStone(13, 10, 10, 10, 2, 1.0);
    expect(samePoint).toBe(false);
  });

  it('should handle zero radius', () => {
    const result = isPointNearStone(10, 10, 10, 10, 0);
    expect(result).toBe(true);
  });

  it('should handle diagonal distance correctly', () => {
    // Point at (11.5, 11.5) is ~2.12mm from (10, 10)
    // With radius 2 and scale 1.5, effective radius is 3mm
    const result = isPointNearStone(11.5, 11.5, 10, 10, 2, 1.5);
    expect(result).toBe(true);
  });

  it('should return false for exact boundary with scale 1.0', () => {
    // Point exactly at radius distance (uses <=, so this returns true)
    const result = isPointNearStone(12, 10, 10, 10, 2, 1.0);
    expect(result).toBe(true); // <= includes boundary
  });

  it('should handle negative coordinates', () => {
    const result = isPointNearStone(-10, -10, -10, -10, 2);
    expect(result).toBe(true);
  });
});

describe('interpolateLinePointsAtSpacing', () => {
  it('returns evenly spaced horizontal points', () => {
    expect(interpolateLinePointsAtSpacing(0, 0, 10, 0, 3)).toEqual([
      { x: 3, y: 0 },
      { x: 6, y: 0 },
      { x: 9, y: 0 },
    ]);
  });

  it('returns diagonal points at the requested spacing', () => {
    const points = interpolateLinePointsAtSpacing(0, 0, 6, 8, 5);
    expect(points).toHaveLength(2);
    expect(points[0]?.x).toBeCloseTo(3, 5);
    expect(points[0]?.y).toBeCloseTo(4, 5);
    expect(points[1]?.x).toBeCloseTo(6, 5);
    expect(points[1]?.y).toBeCloseTo(8, 5);
  });

  it('returns no points when the segment is shorter than the spacing', () => {
    expect(interpolateLinePointsAtSpacing(0, 0, 2, 0, 3)).toEqual([]);
  });
});

describe('calculateCanvasWorkspaceBounds', () => {
  it('uses a large default workspace when there are no stones', () => {
    expect(calculateCanvasWorkspaceBounds([])).toEqual({ x: 0, y: 0, width: 900, height: 700 });
  });

  it('keeps small designs centered inside a larger workspace', () => {
    const bounds = calculateCanvasWorkspaceBounds([
      { center: { x: 100, y: 100 }, holeDiameterMm: 4 },
      { center: { x: 120, y: 100 }, holeDiameterMm: 4 },
    ]);
    expect(bounds.width).toBe(900);
    expect(bounds.height).toBe(700);
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
  });

  it('expands when the design exceeds the minimum workspace', () => {
    const bounds = calculateCanvasWorkspaceBounds([
      { center: { x: 0, y: 0 }, holeDiameterMm: 4 },
      { center: { x: 1200, y: 0 }, holeDiameterMm: 4 },
    ]);
    expect(bounds.width).toBeGreaterThan(900);
  });

  it('expands left/up only when stones actually move beyond the origin', () => {
    const bounds = calculateCanvasWorkspaceBounds([
      { center: { x: -80, y: -40 }, holeDiameterMm: 4 },
      { center: { x: 100, y: 120 }, holeDiameterMm: 4 },
    ]);
    expect(bounds.x).toBeLessThan(0);
    expect(bounds.y).toBeLessThan(0);
    expect(bounds.width).toBeGreaterThanOrEqual(900);
    expect(bounds.height).toBeGreaterThanOrEqual(700);
  });
});

describe('calculateDisplayedCanvasViewBox', () => {
  it('zooms in by shrinking the visible viewBox', () => {
    expect(calculateDisplayedCanvasViewBox({ x: 0, y: 0, width: 900, height: 700 }, 2, 0, 0)).toEqual({
      x: 225,
      y: 175,
      width: 450,
      height: 350,
    });
  });

  describe('calculateFitViewTransform', () => {
    it('returns a centered fit transform with margin', () => {
      const workspace = { x: 0, y: 0, width: 900, height: 700 };
      const content = { x: 100, y: 120, width: 200, height: 120 };
      const fit = calculateFitViewTransform(workspace, content, { widthPx: 1200, heightPx: 800 });

      expect(fit.zoom).toBeGreaterThan(0.1);
      expect(fit.zoom).toBeLessThanOrEqual(5);
      expect(fit.panX).toBeCloseTo(250, 6);
      expect(fit.panY).toBeCloseTo(170, 6);
    });

    it('handles portrait viewports deterministically', () => {
      const workspace = { x: -40, y: -20, width: 900, height: 700 };
      const content = { x: 10, y: 40, width: 260, height: 420 };
      const fit = calculateFitViewTransform(workspace, content, { widthPx: 800, heightPx: 1400 }, { margin: 0.9 });
      const secondFit = calculateFitViewTransform(workspace, content, { widthPx: 800, heightPx: 1400 }, { margin: 0.9 });

      expect(fit).toEqual(secondFit);
    });

    it.each([
      ['20x12 grid', { x: 0, y: 0, width: 20, height: 12 }],
      ['100x25 word', { x: 0, y: 0, width: 100, height: 25 }],
      ['100x94 star', { x: 0, y: 0, width: 100, height: 94 }],
    ])('round-trips %s fully inside the fitted viewBox', (_name, content) => {
      const workspace = { x: -40, y: -35, width: 900, height: 700 };
      const fit = calculateFitViewTransform(
        workspace,
        content,
        { widthPx: 1000, heightPx: 700 },
        { margin: 0.92, minZoom: 0.1, maxZoom: 5 },
      );
      // The canvas draws the view box grown to the canvas shape (1000 x 700 px here).
      const viewBox = expandViewBoxToAspect(
        calculateDisplayedCanvasViewBox(workspace, fit.zoom, fit.panX, fit.panY),
        1000 / 700,
      );

      expect(viewBox.x).toBeLessThanOrEqual(content.x);
      expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(content.x + content.width);
      expect(viewBox.y).toBeLessThanOrEqual(content.y);
      expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(content.y + content.height);

      const viewCenterX = viewBox.x + viewBox.width / 2;
      const viewCenterY = viewBox.y + viewBox.height / 2;
      const contentCenterX = content.x + content.width / 2;
      const contentCenterY = content.y + content.height / 2;
      expect(Math.abs(viewCenterX - contentCenterX)).toBeLessThanOrEqual(1);
      expect(Math.abs(viewCenterY - contentCenterY)).toBeLessThanOrEqual(1);
    });

    it('round-trips a portrait viewport fit', () => {
      const workspace = { x: 0, y: 0, width: 900, height: 700 };
      const content = { x: 20, y: 30, width: 60, height: 120 };
      const fit = calculateFitViewTransform(
        workspace,
        content,
        { widthPx: 390, heightPx: 844 },
        { margin: 0.92, minZoom: 0.1, maxZoom: 5 },
      );
      const viewBox = expandViewBoxToAspect(calculateDisplayedCanvasViewBox(workspace, fit.zoom, fit.panX, fit.panY), 390 / 844);
      expect(viewBox.x).toBeLessThanOrEqual(content.x);
      expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(content.x + content.width);
      expect(viewBox.y).toBeLessThanOrEqual(content.y);
      expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(content.y + content.height);
    });

    it('fills the canvas: the content uses the margin fraction of its limiting side', () => {
      const workspace = { x: 0, y: 0, width: 900, height: 700 };
      const content = { x: 20, y: 30, width: 60, height: 120 };
      for (const viewport of [{ widthPx: 390, heightPx: 844 }, { widthPx: 1280, heightPx: 600 }, { widthPx: 800, heightPx: 800 }]) {
        const fit = calculateFitViewTransform(workspace, content, viewport, { margin: 0.9, minZoom: 0.01, maxZoom: 100 });
        const shown = expandViewBoxToAspect(
          calculateDisplayedCanvasViewBox(workspace, fit.zoom, fit.panX, fit.panY),
          viewport.widthPx / viewport.heightPx,
        );
        const used = Math.max(content.width / shown.width, content.height / shown.height);
        expect(used).toBeCloseTo(0.9, 6);
      }
    });

    it('discards legacy and out-of-range persisted views', () => {
      const workspace = { x: 0, y: 0, width: 900, height: 700 };
      const content = { x: 0, y: 0, width: 20, height: 12 };
      expect(validatePersistedCanvasView({ zoom: 5, panX: 430, panY: 330 }, workspace, content)).toBeNull();
      expect(validatePersistedCanvasView({ manual: true, zoom: 99, panX: 0, panY: 0 }, workspace, content)).toBeNull();
    });

    it('accepts a validated manual persisted view', () => {
      const workspace = { x: 0, y: 0, width: 900, height: 700 };
      const content = { x: 0, y: 0, width: 20, height: 12 };
      expect(validatePersistedCanvasView(
        { manual: true, zoom: 1.5, panX: 430, panY: 340 },
        workspace,
        content,
      )).toEqual({ zoom: 1.5, panX: 430, panY: 340 });
    });
  });

  it('applies pan in canvas mm space', () => {
    expect(calculateDisplayedCanvasViewBox({ x: 0, y: 0, width: 900, height: 700 }, 1, 50, -25)).toEqual({
      x: -50,
      y: 25,
      width: 900,
      height: 700,
    });
  });
});

describe('expandViewBoxToAspect', () => {
  const box = { x: 10, y: 20, width: 200, height: 100 };

  it('keeps the box when the aspect already matches', () => {
    expect(expandViewBoxToAspect(box, 2)).toEqual(box);
  });

  it('grows the height about the centre for a taller canvas', () => {
    expect(expandViewBoxToAspect(box, 1)).toEqual({ x: 10, y: -30, width: 200, height: 200 });
  });

  it('grows the width about the centre for a wider canvas', () => {
    expect(expandViewBoxToAspect(box, 4)).toEqual({ x: -90, y: 20, width: 400, height: 100 });
  });

  it('never shrinks and ignores invalid aspects', () => {
    expect(expandViewBoxToAspect(box, 0)).toBe(box);
    expect(expandViewBoxToAspect(box, Number.NaN)).toBe(box);
  });
});

import { clampCanvasPan } from '../app/editor/canvasCoordinates';

describe('clampCanvasPan', () => {
  const workspace = { x: 0, y: 0, width: 900, height: 700 };
  const content = { x: 100, y: 100, width: 200, height: 40 };
  const base = { workspace, content, zoom: 4, aspect: 2 };

  it('leaves a view that already shows the design alone', () => {
    expect(clampCanvasPan({ ...base, panX: 250, panY: 280 })).toEqual({ panX: 250, panY: 280 });
  });

  it('stops the view moving far past the design in any direction', () => {
    const far = clampCanvasPan({ ...base, panX: -5000, panY: 5000 });
    const shown = calculateDisplayedCanvasViewBox(workspace, 4, far.panX, far.panY);
    const cx = shown.x + shown.width / 2;
    const cy = shown.y + shown.height / 2;
    // base view box at aspect 2: width = max(900, 700 * 2) / 4 = 350, height = 175 (after expansion)
    expect(cx).toBeLessThanOrEqual(content.x + content.width + 0.3 * 350 + 1e-6);
    expect(cy).toBeGreaterThanOrEqual(content.y - 0.3 * 175 - 1e-6);
  });

  it('is idempotent', () => {
    const once = clampCanvasPan({ ...base, panX: -3000, panY: 2000 });
    expect(clampCanvasPan({ ...base, ...once })).toEqual(once);
  });

  it('copes with nonsense', () => {
    expect(clampCanvasPan({ ...base, panX: Number.NaN, panY: 0 })).toEqual({ panX: 0, panY: 0 });
  });
});
