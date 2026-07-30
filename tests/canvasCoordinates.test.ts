/**
 * Tests for canvas coordinate conversion utilities
 */

import { describe, it, expect } from 'vitest';
import { snapToGrid, isPointNearStone } from '../app/editor/canvasCoordinates';

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
