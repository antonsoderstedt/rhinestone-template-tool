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
