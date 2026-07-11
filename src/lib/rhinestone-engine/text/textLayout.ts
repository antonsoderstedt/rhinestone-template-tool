/**
 * Text Layout v2 — helper utilities for dot-matrix text positioning.
 *
 * Handles alignment, bounds calculation, and scaling for the 5×7 dot-matrix
 * font. All values are in millimeters unless otherwise noted.
 *
 * "Column units" and "row units" refer to dot-matrix grid positions
 * (1 unit = 1 spacingMm when rendered).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Width of each glyph in dot columns. */
export const GLYPH_COLUMNS = 5;
/** Height of each glyph in dot rows. */
export const GLYPH_ROWS = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextLayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type TextAlign = 'left' | 'center' | 'right';

// ─── Bounds ───────────────────────────────────────────────────────────────────

/**
 * Returns the natural bounding box (mm) of a dot-matrix text block.
 *
 * `lines` must already be processed (uppercased, split by '\n').
 * Width reflects the longest line; height includes inter-line spacing.
 */
export function calculateDotMatrixTextLayoutBounds(
  lines: string[],
  spacingMm: number,
  letterSpacingColumns: number,
  lineSpacingRows: number,
): TextLayoutBounds {
  if (lines.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const lineWidthCols = (line: string): number =>
    line.length === 0
      ? 0
      : line.length * GLYPH_COLUMNS + (line.length - 1) * letterSpacingColumns;

  const maxCols = Math.max(...lines.map(lineWidthCols));
  const totalRows =
    lines.length * GLYPH_ROWS + Math.max(0, lines.length - 1) * lineSpacingRows;

  const width  = maxCols  * spacingMm;
  const height = totalRows * spacingMm;

  return { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
}

// ─── Alignment ────────────────────────────────────────────────────────────────

/**
 * Returns the x-axis offset (in column units) required to align a single
 * line within a text block.
 *
 * `lineLength`    — character count of the line to align.
 * `maxLineLength` — character count of the longest line in the block.
 */
export function alignDotMatrixLine(
  lineLength: number,
  maxLineLength: number,
  align: TextAlign,
  letterSpacingColumns: number,
): number {
  if (align === 'left' || lineLength >= maxLineLength) return 0;

  const lineWidthCols =
    lineLength === 0
      ? 0
      : lineLength * GLYPH_COLUMNS + (lineLength - 1) * letterSpacingColumns;
  const maxWidthCols =
    maxLineLength === 0
      ? 0
      : maxLineLength * GLYPH_COLUMNS + (maxLineLength - 1) * letterSpacingColumns;

  if (align === 'center') return (maxWidthCols - lineWidthCols) / 2;
  if (align === 'right')  return maxWidthCols - lineWidthCols;
  return 0;
}

// ─── Scaling ──────────────────────────────────────────────────────────────────

/**
 * Computes X and Y scale factors to fit a text block into target dimensions.
 *
 * Returns `{ scaleX: 1, scaleY: 1 }` when no targets are specified.
 * Returns `{ scaleX: 1, scaleY: 1 }` when natural dimensions are 0 (empty text).
 */
export function computeTextScaleFactors(
  naturalWidthMm: number,
  naturalHeightMm: number,
  targetWidthMm?: number,
  targetHeightMm?: number,
  preserveAspectRatio = true,
): { scaleX: number; scaleY: number } {
  if (targetWidthMm === undefined && targetHeightMm === undefined) {
    return { scaleX: 1, scaleY: 1 };
  }

  const canScaleW = targetWidthMm  !== undefined && naturalWidthMm  > 0;
  const canScaleH = targetHeightMm !== undefined && naturalHeightMm > 0;

  if (!canScaleW && !canScaleH) return { scaleX: 1, scaleY: 1 };

  if (preserveAspectRatio) {
    let scale = 1;
    if (canScaleW && canScaleH) {
      scale = Math.min(
        targetWidthMm!  / naturalWidthMm,
        targetHeightMm! / naturalHeightMm,
      );
    } else if (canScaleW) {
      scale = targetWidthMm! / naturalWidthMm;
    } else {
      scale = targetHeightMm! / naturalHeightMm;
    }
    return { scaleX: scale, scaleY: scale };
  }

  return {
    scaleX: canScaleW ? targetWidthMm!  / naturalWidthMm  : 1,
    scaleY: canScaleH ? targetHeightMm! / naturalHeightMm : 1,
  };
}

/**
 * Applies X and Y scale factors to a set of 2D points.
 * Returns a new array — input is never mutated.
 */
export function scaleDotMatrixTextPoints(
  points: Array<{ x: number; y: number }>,
  scaleX: number,
  scaleY: number,
): Array<{ x: number; y: number }> {
  return points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
}
