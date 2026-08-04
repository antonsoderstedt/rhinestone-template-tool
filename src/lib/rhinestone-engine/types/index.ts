// ─── Core scalars ─────────────────────────────────────────────────────────────

export type StoneSizeId = 'SS6' | 'SS8' | 'SS10' | 'SS12' | 'SS16' | 'SS20';

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

// ─── Hole presets (per material, per stone size) ───────────────────────────────

/**
 * Verification status of a hole preset's diameter/calibration data.
 *
 * - `verified`: sourced from a vendor-confirmed physical measurement (e.g. a
 *   TRW spec sheet). Safe to treat as an authoritative starting point.
 * - `provisional`: no verified source exists yet. MUST be physically
 *   calibrated before production use, and MUST be presented to the user as
 *   preliminary — never as an official or definitive figure.
 */
export type HolePresetStatus = 'verified' | 'provisional';

/**
 * A single stone size's hole-cutting data for one material profile.
 *
 * This is the central, authoritative source for "what hole diameter do I cut
 * for stone size X on material Y" — material profiles should define one of
 * these per supported stone size rather than duplicating diameters in UI
 * components or generator code.
 */
export interface HolePreset {
  stoneSize: StoneSizeId;
  /**
   * Default/recommended hole diameter to punch for this stone size on this
   * material (mm). This is the STARTING point for the hole — distinct from
   * the stone's own nominal/physical size (see StoneSizeProfile.stoneDiameterMm).
   */
  holeDiameterMm: number;
  /**
   * The calibration test series for this stone size (mm), used to generate a
   * physical calibration sheet — typically 5 values bracketing holeDiameterMm.
   */
  calibrationValuesMm: number[];
  /** See HolePresetStatus. */
  status: HolePresetStatus;
  /** Human-readable explanation, especially for `provisional` presets. */
  note?: string;
}

// ─── Machine cut recommendations ───────────────────────────────────────────────

/**
 * A recommended starting cut setting for one machine + material combination.
 *
 * This is deliberately a MACHINE/CUTTING concern (blade, pressure, passes,
 * mat) — never mix these fields with template/hole-geometry settings
 * (HolePreset, minimumEdgeSpacingMm). The UI must keep the two concepts
 * visually and structurally separate so a user can't mistake a hole
 * diameter for a pressure value or vice versa.
 */
export interface MachineRecommendation {
  /** e.g. "Cricut Maker 3". */
  machine: string;
  /** e.g. "Magic Flock". */
  material: string;
  /** e.g. "Deep-Point Blade". */
  blade: string;
  /** Cricut Design Space "Custom pressure" value, e.g. 350. */
  customPressure: number;
  /** Cricut Design Space named pressure setting, e.g. "More". */
  pressureSetting: string;
  /** Number of passes, e.g. 1. */
  passes: number;
  /** Whether Design Space's Multi-Cut should be enabled. */
  multiCut: boolean;
  /** Whether the design should be mirrored before cutting. */
  mirror: boolean;
  /** What to do with the material's liner/backing paper before cutting. */
  linerHandling: string;
  /** Recommended cutting mat. */
  mat: string;
  /** Whether a test cut on scrap material is required before a full run. */
  testCutRequired: boolean;
  /** Caveats: blade wear, material batch, mat grip, what to do if holes don't release cleanly. */
  helpText: string;
  /**
   * An older/alternative pressure value still seen in the wild (e.g. for
   * thinner or older Magic Flock batches). Never the primary recommendation —
   * always presented as an explicitly-labelled fallback requiring its own
   * test cut.
   */
  alternativePressure?: {
    customPressure: number;
    label: string;
  };
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
  /** The cutter this profile was characterised for, e.g. "Cricut Maker 3". */
  cutter: string;
  supportedStoneSizes: StoneSizeId[];
  defaultStoneSize: StoneSizeId;
  /**
   * Additional gap added between every pair of holes beyond the stone size's
   * minCenterDistanceMm (mm). Guards against material tearing. Used by the
   * "recommended" (comfortable default) spacing calculation — see
   * getRecommendedCenterDistance.
   */
  spacingSafetyMarginMm: number;
  /**
   * The HARD MINIMUM material left between any two hole edges (mm) — not
   * center-to-center. This is the physical safety floor enforced by
   * collision detection, placement, and validation:
   *   minimumCenterDistance = holeRadiusA + holeRadiusB + minimumEdgeSpacingMm
   * See getMinimumCenterDistance.
   */
  minimumEdgeSpacingMm: number;
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
  /**
   * Per-stone-size hole diameter + calibration data. When present for a
   * given stone size, this is authoritative over the generic
   * StoneSizeProfile.recommendedHoleDiameterMm fallback — see
   * getRecommendedHoleDiameter.
   */
  holePresets?: readonly HolePreset[];
  /** Recommended machine cut settings (blade/pressure/passes/mat) — see MachineRecommendation. */
  machineRecommendations?: readonly MachineRecommendation[];
}

// ─── Template (engine output) ─────────────────────────────────────────────────

/**
 * A shape the cutter should cut as an outer path — e.g. a stencil-card frame
 * around a group of stones. Cricut renders these as native cut-lines rather
 * than as rhinestone holes.
 *
 * Currently only rounded rectangles are supported. Corner radius is optional.
 * Coordinates are in the same mm space as the template's stones.
 */
export interface CutRectShape {
  type: 'rect';
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  /** Corner radius in mm. 0 or undefined means square corners. */
  cornerRadiusMm?: number;
  /** Optional identifier for grouping / labelling (e.g. per-letter card id). */
  id?: string;
}

export type CutShape = CutRectShape;

/** The result produced by the rhinestone engine for a single design. */
export interface RhinestoneTemplate {
  id: string;
  name: string;
  /** Internal unit — always "mm". */
  unit: 'mm';
  stones: Stone[];
  /**
   * Optional additional shapes the cutter should cut as outer paths (e.g.
   * reusable stencil-card frames). Renders alongside stones in SVG export.
   */
  cutShapes?: CutShape[];
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
