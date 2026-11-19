import { describe, expect, it } from 'vitest';
import { describeTraceError, prepareTraceImage, runSilhouetteTrace } from '../app/htv/silhouetteTrace';
import { describe3dFailure, isWebglAvailable } from '../app/htv/webglSupport';

const PARAMS = { threshold: 128, invert: false, smoothingToleranceMm: 0.35, minAreaMm2: 1.5, targetWidthMm: 100 };

/** White image with a black square in the middle. */
function squareImage(size: number, fill = true) {
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  if (fill) {
    const from = Math.floor(size * 0.25);
    const to = Math.floor(size * 0.75);
    for (let y = from; y < to; y += 1) {
      for (let x = from; x < to; x += 1) {
        const i = (y * size + x) * 4;
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
      }
    }
  }
  return { widthPx: size, heightPx: size, rgba };
}

describe('runSilhouetteTrace', () => {
  it('traces a shape', () => {
    const outcome = runSilhouetteTrace(squareImage(40), PARAMS);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.trace.polylines.length).toBeGreaterThan(0);
  });

  it('reports "empty" with advice when nothing passes the threshold', () => {
    const outcome = runSilhouetteTrace(squareImage(40, false), PARAMS);
    expect(outcome.status).toBe('empty');
    if (outcome.status === 'empty') expect(outcome.message).toMatch(/threshold|invert/i);
  });

  it('reports "error" instead of throwing for unreadable pixel data', () => {
    const outcome = runSilhouetteTrace({ widthPx: 10, heightPx: 10, rgba: new Uint8ClampedArray(7) }, PARAMS);
    expect(outcome.status).toBe('error');
    if (outcome.status === 'error') expect(outcome.message).toMatch(/pixel data/i);
  });

  it('is deterministic', () => {
    const image = squareImage(40);
    expect(runSilhouetteTrace(image, PARAMS)).toEqual(runSilhouetteTrace(image, PARAMS));
  });
});

describe('prepareTraceImage', () => {
  it('leaves small images alone', () => {
    const image = squareImage(40);
    const prepared = prepareTraceImage(image, 10_000);
    expect(prepared.image).toBe(image);
    expect(prepared.downscaledFrom).toBeNull();
  });

  it('shrinks big images under the pixel budget and records the original size', () => {
    const prepared = prepareTraceImage(squareImage(200), 10_000);
    expect(prepared.downscaledFrom).toEqual({ widthPx: 200, heightPx: 200 });
    expect(prepared.image.widthPx * prepared.image.heightPx).toBeLessThanOrEqual(10_000);
    expect(prepared.image.rgba.length).toBe(prepared.image.widthPx * prepared.image.heightPx * 4);
  });

  it('keeps the shape when shrinking', () => {
    const prepared = prepareTraceImage(squareImage(200), 10_000);
    expect(runSilhouetteTrace(prepared.image, PARAMS).status).toBe('ok');
  });

  it('is deterministic', () => {
    expect(prepareTraceImage(squareImage(120), 5_000)).toEqual(prepareTraceImage(squareImage(120), 5_000));
  });
});

describe('describeTraceError', () => {
  it('explains oversized input in plain language', () => {
    expect(describeTraceError(new RangeError('Invalid array length'))).toMatch(/too large/i);
  });
  it('never returns an empty message', () => {
    expect(describeTraceError(undefined).length).toBeGreaterThan(0);
  });
});

describe('isWebglAvailable', () => {
  it('is true when a context can be created, and releases it again', () => {
    let released = false;
    const context = { getExtension: () => ({ loseContext: () => { released = true; } }) };
    expect(isWebglAvailable(() => ({ getContext: (id: string) => (id === 'webgl2' ? context : null) }))).toBe(true);
    expect(released).toBe(true);
  });

  it('falls back to webgl1', () => {
    expect(isWebglAvailable(() => ({ getContext: (id: string) => (id === 'webgl' ? {} : null) }))).toBe(true);
  });

  it('is false when no context can be created, or the probe throws', () => {
    expect(isWebglAvailable(() => ({ getContext: () => null }))).toBe(false);
    expect(isWebglAvailable(() => { throw new Error('no canvas'); })).toBe(false);
  });
});

describe('describe3dFailure', () => {
  it('has a message for every failure kind', () => {
    expect(describe3dFailure('unsupported')).toMatch(/WebGL/);
    expect(describe3dFailure('lost')).toMatch(/graphics context/);
    expect(describe3dFailure('error', 'boom')).toContain('boom');
  });
});
