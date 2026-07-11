/**
 * Calibration Override Module
 *
 * Allows users to record measured hole diameters from physical cut tests and
 * apply those calibrated values to generated templates.
 *
 * Overrides replace the provisional recommended hole diameters from stone profiles
 * with values the user has verified work for their specific machine + blade +
 * flock batch combination.
 *
 * In this sprint, overrides are in-memory only. Persistent saved profiles are
 * deferred to a future sprint.
 */

import type { StoneSizeId, RhinestoneTemplate, Stone } from '../types/index';
import { getRecommendedHoleDiameter } from '../profiles/materialProfiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibratedHoleSizeOverride {
  stoneSize: StoneSizeId;
  /** Measured hole diameter that works for this stone size (mm). Must be > 0. */
  holeDiameterMm: number;
  materialProfileId: string;
  /** Optional free-text notes (e.g. blade pressure used, date tested). */
  notes?: string;
}

export interface CalibrationOverrideSet {
  id: string;
  name: string;
  /** The material profile these overrides were derived from. */
  materialProfileId: string;
  overrides: CalibratedHoleSizeOverride[];
}

export interface CreateCalibrationOverrideSetInput {
  id: string;
  name: string;
  materialProfileId: string;
  overrides: Array<{
    stoneSize: StoneSizeId;
    /** Measured hole diameter (mm). Must be > 0. */
    holeDiameterMm: number;
    notes?: string;
  }>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a validated CalibrationOverrideSet from user-supplied measured values.
 *
 * @throws if any holeDiameterMm is <= 0.
 */
export function createCalibrationOverrideSet(
  input: CreateCalibrationOverrideSetInput,
): CalibrationOverrideSet {
  for (const o of input.overrides) {
    if (typeof o.holeDiameterMm !== 'number' || o.holeDiameterMm <= 0) {
      throw new Error(
        `createCalibrationOverrideSet: holeDiameterMm must be a positive number ` +
          `for ${o.stoneSize}, got ${o.holeDiameterMm}.`,
      );
    }
  }

  return {
    id: input.id,
    name: input.name,
    materialProfileId: input.materialProfileId,
    overrides: input.overrides.map((o) => ({
      stoneSize: o.stoneSize,
      holeDiameterMm: o.holeDiameterMm,
      materialProfileId: input.materialProfileId,
      notes: o.notes,
    })),
  };
}

/**
 * Returns the calibrated hole diameter for a given stone size.
 *
 * If `overrideSet` contains an override for `stoneSize` (matching the
 * materialProfileId), that value is returned. Otherwise falls back to the
 * recommended hole diameter from the engine profiles.
 */
export function getCalibratedHoleDiameter(
  stoneSize: StoneSizeId,
  materialProfileId: string | undefined,
  overrideSet?: CalibrationOverrideSet,
): number {
  if (overrideSet) {
    const effectiveProfileId = materialProfileId ?? overrideSet.materialProfileId;
    const override = overrideSet.overrides.find(
      (o) => o.stoneSize === stoneSize && o.materialProfileId === effectiveProfileId,
    );
    if (override) {
      return override.holeDiameterMm;
    }
  }
  return getRecommendedHoleDiameter(stoneSize, materialProfileId);
}

/**
 * Returns a new RhinestoneTemplate with hole diameters replaced by calibrated
 * values where an override exists for the stone's size.
 *
 * Stones with no matching override are kept unchanged.
 * The original template is never mutated.
 *
 * Updated stones receive extra metadata:
 * - `calibrated: true`
 * - `calibratedHoleDiameterMm`
 * - `originalHoleDiameterMm`
 */
export function applyCalibrationOverridesToTemplate(
  template: RhinestoneTemplate,
  overrideSet: CalibrationOverrideSet,
): RhinestoneTemplate {
  // Build a lookup: stoneSize → calibratedHoleDiameterMm
  const overrideMap = new Map<string, number>();
  for (const o of overrideSet.overrides) {
    overrideMap.set(o.stoneSize, o.holeDiameterMm);
  }

  const newStones: Stone[] = template.stones.map((stone) => {
    const calibratedDiameter = overrideMap.get(stone.stoneSize);
    if (calibratedDiameter === undefined) {
      // No override for this stone size — return a shallow clone unchanged
      return { ...stone, metadata: stone.metadata ? { ...stone.metadata } : undefined };
    }
    return {
      ...stone,
      holeDiameterMm: calibratedDiameter,
      metadata: {
        ...stone.metadata,
        calibrated: true,
        calibratedHoleDiameterMm: calibratedDiameter,
        originalHoleDiameterMm: stone.holeDiameterMm,
      },
    };
  });

  return {
    ...template,
    stones: newStones,
  };
}
