import { describe, expect, it } from 'vitest';
import {
  getCalibrationGateSummary,
  getRecoveryActionPlan,
  getWorkspaceRecoverySummary,
} from '../app/lib/workspaceRecovery';
import type { WorkspaceVault } from '../app/lib/workspaceVault';
import { DEFAULT_WORKSPACE_SETTINGS } from '../app/lib/workspaceSettings';

const baseVault: WorkspaceVault = {
  version: 1,
  assets: [],
  uploadedFonts: [],
  fontPreferences: [],
  htvDesigns: [
    {
      designId: 'htv-1',
      name: 'Test HTV',
      tags: ['shirt'],
      favorite: false,
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      previewText: 'Test',
      layerCount: 2,
      garmentLabel: 'T-shirt · M · 1 placement',
      snapshot: {
        projectName: 'Test HTV',
        layers: [],
        selectedLayerIds: [],
        canvas: { zoom: 1, panX: 0, panY: 0 },
        garment: { type: 'tee', size: 'M', colorId: 'white', placementZone: 'full-front', activePlacementZones: ['full-front'] },
        history: { past: [], future: [] },
      },
    },
  ],
  designPreferences: [
    { designKey: 'rhinestone-1', archived: false },
    { designKey: 'rhinestone-2', archived: false },
  ],
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  calibrationProfiles: [
    {
      id: 'profile-1',
      name: 'Magic Flock',
      materialProfileId: 'magic-flock',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      approvedAt: '2024-01-03T00:00:00.000Z',
      overrides: [],
    },
  ],
};

describe('workspace recovery summary', () => {
  it('aggregates saved work and active calibration readiness', () => {
    const summary = getWorkspaceRecoverySummary(baseVault, true);

    expect(summary.totalSavedDesigns).toBe(3);
    expect(summary.rhinestoneSavedCount).toBe(2);
    expect(summary.htvSavedCount).toBe(1);
    expect(summary.approvedCalibrationCount).toBe(1);
    expect(summary.workflowStatus).toBe('Ready');
  });

  it('summarizes the calibration gate for the setup workflow', () => {
    expect(getCalibrationGateSummary(baseVault, 'profile-1')).toMatchObject({
      activeProfileName: 'Magic Flock',
      activeProfileApproved: true,
      approvedCalibrationCount: 1,
      workflowState: 'Ready',
    });

    expect(getCalibrationGateSummary({
      ...baseVault,
      calibrationProfiles: [{
        id: 'profile-2',
        name: 'Pending profile',
        materialProfileId: 'magic-flock',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        overrides: [],
      }],
    }, 'profile-2')).toMatchObject({
      activeProfileName: 'Pending profile',
      activeProfileApproved: false,
      approvedCalibrationCount: 0,
      workflowState: 'Warning',
    });
  });

  it('flags calibration risk when no approved profile exists', () => {
    const summary = getWorkspaceRecoverySummary({
      ...baseVault,
      calibrationProfiles: [{
        id: 'profile-2',
        name: 'Pending profile',
        materialProfileId: 'magic-flock',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        overrides: [],
      }],
    }, false);

    expect(summary.approvedCalibrationCount).toBe(0);
    expect(summary.workflowStatus).toBe('Warning');
  });

  it('prefers the most urgent recovery action in order', () => {
    expect(getRecoveryActionPlan(baseVault, true)).toMatchObject({
      label: 'Resume autosave',
      href: '/rhinestone',
    });

    expect(getRecoveryActionPlan({
      ...baseVault,
      calibrationProfiles: [{
        id: 'profile-2',
        name: 'Pending profile',
        materialProfileId: 'magic-flock',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        overrides: [],
      }],
    }, false)).toMatchObject({
      label: 'Review calibration',
      href: '/setup',
    });

    expect(getRecoveryActionPlan({
      ...baseVault,
      calibrationProfiles: [{
        ...baseVault.calibrationProfiles[0],
        approvedAt: '2024-02-01T00:00:00.000Z',
      }],
    }, false)).toMatchObject({
      label: 'Open saved work',
      href: '/designs',
    });
  });
});
