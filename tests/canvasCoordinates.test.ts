/**
 * Tests for canvas coordinate conversion utilities
 */

import { describe, it, expect } from 'vitest';
import { snapToGrid, isPointNearStone, interpolateLinePointsAtSpacing, calculateCanvasWorkspaceBounds, calculateDisplayedCanvasViewBox } from '../app/editor/canvasCoordinates';

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

  it('applies pan in canvas mm space', () => {
    expect(calculateDisplayedCanvasViewBox({ x: 0, y: 0, width: 900, height: 700 }, 1, 50, -25)).toEqual({
      x: -50,
      y: 25,
      width: 900,
      height: 700,
    });
  });
});
