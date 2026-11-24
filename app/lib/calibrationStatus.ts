/**
 * Calibration status for each stone size in a design: measured on the user's own material, a verified standard value, or an
 * unverified starting value. The studio used to say only "Needs calibration"; this says which stone sizes and why.
 *
 * Pure.
 */

import { getHolePreset, type StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import type { CalibrationProfile } from './workspaceVault';

export type SizeCalibrationState = 'measured' | 'verified-default' | 'unverified';

export interface SizeCalibrationStatus {
  stoneSize: StoneSizeId;
  state: SizeCalibrationState;
  /** One line a person can read. */
  text: string;
}

export function calibrationStatusBySize(
  stoneSizes: readonly StoneSizeId[],
  profile: Pick<CalibrationProfile, 'approvedAt' | 'overrides' | 'name' | 'materialProfileId'> | null,
): SizeCalibrationStatus[] {
  const order: StoneSizeId[] = [];
  for (const size of stoneSizes) if (!order.includes(size)) order.push(size);
  order.sort((a, b) => parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10));

  return order.map((stoneSize): SizeCalibrationStatus => {
    const measured = profile?.approvedAt ? profile.overrides.find((override) => override.stoneSize === stoneSize) : undefined;
    if (profile && measured) {
      return { stoneSize, state: 'measured', text: `${stoneSize}: measured on your material (${measured.holeDiameterMm} mm), in "${profile.name}".` };
    }
    const preset = getHolePreset(stoneSize, profile?.materialProfileId);
    if (preset?.status === 'verified') {
      return { stoneSize, state: 'verified-default', text: `${stoneSize}: the standard value for this material (${preset.holeDiameterMm} mm). Not measured on yours; a test patch is worth cutting.` };
    }
    return { stoneSize, state: 'unverified', text: `${stoneSize}: only a starting value. Calibrate it before you cut for real.` };
  });
}

/** True when every size in the design is measured or has a verified standard value. */
export const allSizesUsable = (statuses: readonly SizeCalibrationStatus[]): boolean => statuses.every((status) => status.state !== 'unverified');
