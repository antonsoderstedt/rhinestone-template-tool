import type { WorkspaceVault } from './workspaceVault';

export type WorkspaceRecoverySummary = {
  totalSavedDesigns: number;
  rhinestoneSavedCount: number;
  htvSavedCount: number;
  approvedCalibrationCount: number;
  activeCalibrationProfileName: string | null;
  hasAutosave: boolean;
  workflowStatus: 'Ready' | 'Warning' | 'Blocked';
};

export type CalibrationGateSummary = {
  activeProfileName: string | null;
  activeProfileApproved: boolean;
  approvedCalibrationCount: number;
  lastApprovedAt: string | null;
  workflowState: 'Ready' | 'Warning';
  nextStep: string;
};

export type RecoveryActionPlan = {
  label: string;
  description: string;
  href: string;
};

export function getCalibrationGateSummary(vault: WorkspaceVault, activeProfileId: string | null = null): CalibrationGateSummary {
  const profiles = [...vault.calibrationProfiles].sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId)
    ?? profiles.find((profile) => profile.approvedAt)
    ?? profiles[0]
    ?? null;
  const approvedProfiles = profiles.filter((profile) => Boolean(profile.approvedAt));
  const lastApproved = approvedProfiles[0] ?? null;

  const workflowState: 'Ready' | 'Warning' = approvedProfiles.length > 0 ? 'Ready' : 'Warning';

  return {
    activeProfileName: activeProfile?.name ?? null,
    activeProfileApproved: Boolean(activeProfile?.approvedAt),
    approvedCalibrationCount: approvedProfiles.length,
    lastApprovedAt: lastApproved?.approvedAt ?? null,
    workflowState,
    nextStep: approvedProfiles.length > 0
      ? 'Production is gated by an approved profile. Keep this setup visible before export.'
      : 'Approve the active calibration profile before the next production cut.',
  };
}

export function getRecoveryActionPlan(vault: WorkspaceVault, hasAutosave = false): RecoveryActionPlan {
  const hasApprovedProfile = vault.calibrationProfiles.some((profile) => Boolean(profile.approvedAt));

  if (hasAutosave) {
    return {
      label: 'Resume autosave',
      description: 'Jump back into the latest local draft before the next production pass.',
      href: '/rhinestone',
    };
  }

  if (!hasApprovedProfile) {
    return {
      label: 'Review calibration',
      description: 'Approve a material profile before export or production cut work begins.',
      href: '/setup',
    };
  }

  return {
    label: 'Open saved work',
    description: 'Return to the active saved design set and continue the most recent production workflow.',
    href: '/designs',
  };
}

export function getWorkspaceRecoverySummary(vault: WorkspaceVault, hasAutosave = false): WorkspaceRecoverySummary {
  const approvedCalibrationCount = vault.calibrationProfiles.filter((profile) => Boolean(profile.approvedAt)).length;
  const activeCalibrationProfile = vault.calibrationProfiles.find((profile) => profile.approvedAt) ?? null;

  let workflowStatus: 'Ready' | 'Warning' | 'Blocked' = 'Ready';
  if (vault.calibrationProfiles.length === 0) workflowStatus = 'Warning';
  else if (approvedCalibrationCount === 0) workflowStatus = 'Warning';
  else if (!hasAutosave && vault.designPreferences.length === 0 && vault.htvDesigns.length === 0) workflowStatus = 'Blocked';

  return {
    totalSavedDesigns: vault.htvDesigns.length + vault.designPreferences.length,
    rhinestoneSavedCount: vault.designPreferences.length,
    htvSavedCount: vault.htvDesigns.length,
    approvedCalibrationCount,
    activeCalibrationProfileName: activeCalibrationProfile?.name ?? null,
    hasAutosave,
    workflowStatus,
  };
}

/** The home page only shows its "pick up where you left off" card when there is something to pick up. */
export function hasAnythingToRecover(summary: Pick<WorkspaceRecoverySummary, 'totalSavedDesigns' | 'hasAutosave'>): boolean {
  return summary.hasAutosave || summary.totalSavedDesigns > 0;
}
