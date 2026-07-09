// ─── Core scalars ─────────────────────────────────────────────────────────────

export type StoneSizeId = 'SS6' | 'SS8' | 'SS10' | 'SS12';

export type Unit = 'mm' | 'in';

// ─── Geometry primitives ──────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  center: Point;
  radiusMm: number;
}

// ─── Stone ────────────────────────────────────────────────────────────────────

export interface Stone {
  id: string;
  center: Point;
  stoneSize: StoneSizeId;
  holeDiameterMm: number;
  metadata?: Record<string, string | number | boolean>;
}

// ─── Stone size profile ───────────────────────────────────────────────────────

/**
 * Describes the physical dimensions of a single rhinestone size.
 *
 * NOTE: All diameter and distance values are PROVISIONAL starting points.
 * They must be validated by cutting physical test sheets on your specific
 * material with your specific machine and blade before production use.
 * Actual dimensions vary by stone supplier, blade condition, cut pressure,
 * mat tackiness, and flock material batch.
 */
export interface StoneSizeProfile {
  id: StoneSizeId;
  /** Human-readable label, e.g. "SS10 (2.8 mm)" */
  label: string;
  /** Physical outer diameter of the rhinestone (mm). */
  stoneDiameterMm: number;
  /**
   * Recommended hole diameter to punch in the template material (mm).
   * Slightly larger than the stone so the stone snaps in cleanly.
   * MUST be validated by physical cut test.
   */
  recommendedHoleDiameterMm: number;
  /**
   * Minimum center-to-center distance between any two holes (mm).
   * Derived from hole diameter + safety margin.
   * MUST be validated by physical cut test.
   */
  minCenterDistanceMm: number;
  /** Human-readable notes about this size. */
  notes: string;
  /**
   * Always `true`. Signals that this profile has not been physically validated
   * for the current machine/material combination and must be calibrated before
   * use in production.
   */
  requiresPhysicalValidation: true;
}

// ─── Material profile ─────────────────────────────────────────────────────────

/**
 * Describes the physical properties of a cutter + material combination.
 *
 * NOTE: kerfCompensationMm and scaleCompensationPercent start at 0 and
 * must be derived from a physical calibration cut before production use.
 */
export interface MaterialProfile {
  id: string;
  name: string;
  /** The cutter this profile was characterised for, e.g. "Cricut Maker". */
  cutter: string;
  supportedStoneSizes: StoneSizeId[];
  defaultStoneSize: StoneSizeId;
  /**
   * Additional gap added between every pair of holes beyond the stone size's
   * minCenterDistanceMm (mm). Guards against material tearing.
   */
  spacingSafetyMarginMm: number;
  /**
   * Diameter added to every hole to compensate for blade kerf (mm).
   * Start at 0; calibrate from a physical test cut.
   */
  kerfCompensationMm: number;
  /**
   * Percentage by which all coordinates are scaled to correct for a machine's
   * dimensional inaccuracy. Start at 0; calibrate from a physical test cut.
   */
  scaleCompensationPercent: number;
  notes: string;
  /**
   * Always `true`. Signals that kerfCompensationMm and scaleCompensationPercent
   * have not been set from a physical calibration cut and must be calibrated
   * before this profile is used in production.
   */
  requiresCalibration: true;
}

// ─── Template (engine output) ─────────────────────────────────────────────────

/** The result produced by the rhinestone engine for a single design. */
export interface RhinestoneTemplate {
  id: string;
  name: string;
  /** Internal unit — always "mm". */
  unit: 'mm';
  stones: Stone[];
  widthMm?: number;
  heightMm?: number;
  metadata?: Record<string, string | number | boolean>;
}

// ─── Export options ────────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Draw a bounding rectangle around the design. Default: false. */
  includeGuideBox?: boolean;
  /** Annotate each stone with its size id. Default: false. */
  includeLabels?: boolean;
  /** Padding added around the design on all sides (mm). Default: 0. */
  paddingMm?: number;
  /** Number of decimal places in coordinate output. Default: 4. */
  decimalPlaces?: number;
}
