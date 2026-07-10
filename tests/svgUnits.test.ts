import { describe, it, expect } from 'vitest';
import {
  parseSvgViewBox,
  getSvgRootAttributes,
} from '../src/lib/rhinestone-engine/index.js';

describe('parseSvgViewBox', () => {
  it('parses a valid viewBox attribute', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect /></svg>';
    expect(parseSvgViewBox(svg)).toEqual({ minX: 0, minY: 0, width: 100, height: 50 });
  });

  it('parses viewBox with negative minX/minY', () => {
    const svg = '<svg viewBox="-10 -5 200 100"></svg>';
    expect(parseSvgViewBox(svg)).toEqual({ minX: -10, minY: -5, width: 200, height: 100 });
  });

  it('returns null when no viewBox attribute is present', () => {
    expect(parseSvgViewBox('<svg width="100" height="50"><rect /></svg>')).toBeNull();
  });

  it('returns null when there is no <svg> tag', () => {
    expect(parseSvgViewBox('<circle cx="10" cy="10" r="5" />')).toBeNull();
  });

  it('returns null when viewBox has fewer than 4 values', () => {
    expect(parseSvgViewBox('<svg viewBox="0 0 100"></svg>')).toBeNull();
  });
});

describe('getSvgRootAttributes', () => {
  it('extracts width and height from the root <svg>', () => {
    const svg = '<svg width="100mm" height="50mm"><rect /></svg>';
    const attrs = getSvgRootAttributes(svg);
    expect(attrs.width).toBe('100mm');
    expect(attrs.height).toBe('50mm');
  });

  it('returns null width/height when absent', () => {
    const attrs = getSvgRootAttributes('<svg><rect /></svg>');
    expect(attrs.width).toBeNull();
    expect(attrs.height).toBeNull();
  });

  it('includes parsed viewBox when present', () => {
    const svg = '<svg viewBox="0 0 200 100" width="200mm" height="100mm"></svg>';
    const attrs = getSvgRootAttributes(svg);
    expect(attrs.viewBox).toEqual({ minX: 0, minY: 0, width: 200, height: 100 });
    expect(attrs.width).toBe('200mm');
  });

  it('returns all nulls when there is no <svg> tag', () => {
    const attrs = getSvgRootAttributes('<rect />');
    expect(attrs.viewBox).toBeNull();
    expect(attrs.width).toBeNull();
    expect(attrs.height).toBeNull();
  });
});
