/**
 * Plumbing around the engine's `traceImageSilhouette` for the HTV converter
 * dialog: large photos are shrunk before tracing (tracing a 12-megapixel image
 * on every slider tick froze the page), and every outcome — traced, nothing
 * found, failed — is returned as data so the dialog can show it instead of an
 * empty preview. Pure and deterministic.
 */

import {
  traceImageSilhouette,
  type ImageTraceResult,
  type TraceableImageData,
} from '@/src/lib/rhinestone-engine/index';

/** Most pixels we trace at. Above this the extra pixels only add time, not detail a vinyl cutter can use. */
export const MAX_TRACE_PIXELS = 1_500_000;

export interface SilhouetteTraceParams {
  threshold: number;
  invert: boolean;
  smoothingToleranceMm: number;
  minAreaMm2: number;
  targetWidthMm: number;
}

export type SilhouetteTraceOutcome =
  | { status: 'ok'; trace: ImageTraceResult }
  /** The trace ran but found no shape; `trace.polylines` is empty. */
  | { status: 'empty'; trace: ImageTraceResult; message: string }
  | { status: 'error'; message: string };

export interface PreparedTraceImage {
  image: TraceableImageData;
  /** Original size when the image was shrunk, otherwise null. */
  downscaledFrom: { widthPx: number; heightPx: number } | null;
}

/**
 * Shrinks `image` to at most `maxPixels` pixels by averaging the source pixels that fall into each
 * new pixel (a box filter), which keeps edges smoother than picking single pixels. Returns the
 * original image untouched when it is already small enough.
 */
export function prepareTraceImage(image: TraceableImageData, maxPixels: number = MAX_TRACE_PIXELS): PreparedTraceImage {
  const totalPixels = image.widthPx * image.heightPx;
  if (!(totalPixels > maxPixels) || image.rgba.length !== totalPixels * 4) {
    return { image, downscaledFrom: null };
  }

  const factor = Math.sqrt(maxPixels / totalPixels);
  const widthPx = Math.max(1, Math.floor(image.widthPx * factor));
  const heightPx = Math.max(1, Math.floor(image.heightPx * factor));
  const rgba = new Uint8ClampedArray(widthPx * heightPx * 4);

  for (let y = 0; y < heightPx; y += 1) {
    const sourceY0 = Math.floor((y * image.heightPx) / heightPx);
    const sourceY1 = Math.max(sourceY0 + 1, Math.floor(((y + 1) * image.heightPx) / heightPx));
    for (let x = 0; x < widthPx; x += 1) {
      const sourceX0 = Math.floor((x * image.widthPx) / widthPx);
      const sourceX1 = Math.max(sourceX0 + 1, Math.floor(((x + 1) * image.widthPx) / widthPx));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = sourceY0; sy < sourceY1; sy += 1) {
        for (let sx = sourceX0; sx < sourceX1; sx += 1) {
          const index = (sy * image.widthPx + sx) * 4;
          r += image.rgba[index]!;
          g += image.rgba[index + 1]!;
          b += image.rgba[index + 2]!;
          a += image.rgba[index + 3]!;
          count += 1;
        }
      }
      const out = (y * widthPx + x) * 4;
      rgba[out] = Math.round(r / count);
      rgba[out + 1] = Math.round(g / count);
      rgba[out + 2] = Math.round(b / count);
      rgba[out + 3] = Math.round(a / count);
    }
  }

  return {
    image: { widthPx, heightPx, rgba },
    downscaledFrom: { widthPx: image.widthPx, heightPx: image.heightPx },
  };
}

/** A plain-language reason for a failed trace. */
export function describeTraceError(error: unknown): string {
  if (error instanceof RangeError) {
    return 'This image is too large or too detailed to trace. Try a smaller image.';
  }
  const text = error instanceof Error ? error.message : '';
  if (/rgba length|widthPx|heightPx/i.test(text)) {
    return "The image's pixel data could not be read. Try saving it again as a PNG or JPG.";
  }
  return text ? `Tracing failed: ${text}` : 'Tracing failed for an unknown reason. Try a different image.';
}

export function runSilhouetteTrace(image: TraceableImageData, params: SilhouetteTraceParams): SilhouetteTraceOutcome {
  try {
    const trace = traceImageSilhouette({
      image,
      threshold: params.threshold,
      invert: params.invert,
      smoothingToleranceMm: params.smoothingToleranceMm,
      minAreaMm2: params.minAreaMm2,
      targetWidthMm: params.targetWidthMm,
      preserveAspectRatio: true,
    });
    if (trace.polylines.length === 0) {
      return {
        status: 'empty',
        trace,
        message: trace.warnings.join(' ') || 'No shape was found. Try moving the Threshold slider or turning on Invert.',
      };
    }
    return { status: 'ok', trace };
  } catch (error) {
    return { status: 'error', message: describeTraceError(error) };
  }
}
