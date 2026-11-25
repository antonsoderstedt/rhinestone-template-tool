import { describe, expect, it } from 'vitest';
import { createTemplateLibraryEntry } from '../src/lib/rhinestone-engine/templateLibrary/model';
import type { TemplateLibraryEntry } from '../src/lib/rhinestone-engine/index';
import type { HtvDesignEntry } from '../app/lib/workspaceVault';
import {
  MAX_BACKUP_FILE_BYTES,
  buildBackupFilename,
  createWorkspaceBackup,
  describeMergeSummary,
  mergeWorkspaceBackup,
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
} from '../app/lib/workspaceBackup';

function rhinestoneEntry(id: string, name: string, updatedAt = '2026-08-03T00:00:00.000Z'): TemplateLibraryEntry {
  return createTemplateLibraryEntry({
    templateId: id,
    name,
    category: 'manual',
    tags: ['t'],
    builtIn: false,
    readOnly: false,
    favorite: false,
    previewRef: null,
    widthMm: 10,
    heightMm: 10,
    stoneCount: 0,
    stoneSizes: ['SS10'],
    colorLayerCount: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    snapshot: {
      schemaVersion: 1,
      savedAt: updatedAt,
      projectName: name,
      generatorState: { generatorId: 'manual-editor', stones: [], includeGuideBox: true, paddingMm: 5 },
      activeTool: 'manual',
    },
  });
}

function htvEntry(id: string, name: string, updatedAt = '2026-08-03T00:00:00.000Z'): HtvDesignEntry {
  return {
    designId: id,
    name,
    tags: [],
    favorite: false,
    archived: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    previewText: 'Hi',
    layerCount: 0,
    garmentLabel: 'Tee',
    snapshot: {
      projectName: name,
      layers: [],
      selectedLayerIds: [],
      canvas: {} as HtvDesignEntry['snapshot']['canvas'],
      garment: {} as HtvDesignEntry['snapshot']['garment'],
      history: { past: [], future: [] },
    },
  };
}

const NOW = '2026-11-19T10:00:00.000Z';

describe('backup file', () => {
  it('round-trips designs through serialize and parse', () => {
    const backup = createWorkspaceBackup({ rhinestoneDesigns: [rhinestoneEntry('r1', 'Name')], htvDesigns: [htvEntry('h1', 'Shirt')], createdAt: NOW });
    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(backup));
    expect(parsed.skippedCount).toBe(0);
    expect(parsed.backup.rhinestoneDesigns.map((d) => d.name)).toEqual(['Name']);
    expect(parsed.backup.htvDesigns.map((d) => d.name)).toEqual(['Shirt']);
    expect(parsed.backup.createdAt).toBe(NOW);
  });

  it('names the file after the day it was made', () => {
    expect(buildBackupFilename(NOW)).toBe('rhinestone-studio-2026-11-19.backup.json');
    expect(buildBackupFilename('nonsense')).toBe('rhinestone-studio-backup.backup.json');
  });

  it('rejects things that are not backups, with a clear message', () => {
    expect(() => parseWorkspaceBackup('{nope')).toThrow(/not valid JSON/);
    expect(() => parseWorkspaceBackup('{"hello":1}')).toThrow(/not a Rhinestone Studio backup/);
    expect(() => parseWorkspaceBackup('[]')).toThrow(/not a Rhinestone Studio backup/);
    expect(() => parseWorkspaceBackup(JSON.stringify({ kind: 'rhinestone-studio-backup', version: 9, rhinestoneDesigns: [], htvDesigns: [] }))).toThrow(/newer version/);
    expect(() => parseWorkspaceBackup(JSON.stringify({ kind: 'rhinestone-studio-backup', version: 1 }))).toThrow(/damaged/);
  });

  it('skips unreadable entries instead of failing the whole restore', () => {
    const good = rhinestoneEntry('r1', 'Good');
    const raw = JSON.stringify({
      kind: 'rhinestone-studio-backup',
      version: 1,
      createdAt: NOW,
      rhinestoneDesigns: [good, { templateId: 'bad', name: 'Bad', createdAt: 'x', updatedAt: 'y', snapshot: { project: { schemaVersion: 99 } } }, 5, null],
      htvDesigns: [htvEntry('h1', 'Shirt'), { designId: 'h2' }],
    });
    const parsed = parseWorkspaceBackup(raw);
    expect(parsed.backup.rhinestoneDesigns.map((d) => d.templateId)).toEqual(['r1']);
    expect(parsed.backup.htvDesigns.map((d) => d.designId)).toEqual(['h1']);
    expect(parsed.skippedCount).toBe(4);
  });

  it('never lets a backup create built-in or read-only entries', () => {
    const sneaky = { ...rhinestoneEntry('r1', 'X'), builtIn: true, readOnly: true };
    const parsed = parseWorkspaceBackup(JSON.stringify({ kind: 'rhinestone-studio-backup', version: 1, createdAt: NOW, rhinestoneDesigns: [sneaky], htvDesigns: [] }));
    expect(parsed.backup.rhinestoneDesigns[0]).toMatchObject({ builtIn: false, readOnly: false });
  });

  it('has a sane size limit', () => {
    expect(MAX_BACKUP_FILE_BYTES).toBeGreaterThan(1024 * 1024);
  });
});

describe('mergeWorkspaceBackup', () => {
  const backup = createWorkspaceBackup({
    rhinestoneDesigns: [rhinestoneEntry('new', 'New'), rhinestoneEntry('newer', 'Newer in backup', '2026-10-01T00:00:00.000Z'), rhinestoneEntry('older', 'Older in backup', '2026-01-01T00:00:00.000Z')],
    htvDesigns: [htvEntry('h-new', 'New HTV'), htvEntry('h-same', 'Same HTV')],
    createdAt: NOW,
  });
  const existing = {
    rhinestoneDesigns: [rhinestoneEntry('newer', 'Old here', '2026-08-01T00:00:00.000Z'), rhinestoneEntry('older', 'Newer here', '2026-09-01T00:00:00.000Z'), rhinestoneEntry('only-here', 'Only here')],
    htvDesigns: [htvEntry('h-same', 'Same HTV')],
  };

  it('adds what is missing, replaces only with a newer copy and deletes nothing', () => {
    const result = mergeWorkspaceBackup(existing, backup);
    const byId = Object.fromEntries(result.rhinestoneDesigns.map((d) => [d.templateId, d.name]));
    expect(byId).toEqual({ new: 'New', newer: 'Newer in backup', older: 'Newer here', 'only-here': 'Only here' });
    expect(result.htvDesigns.map((d) => d.designId).sort()).toEqual(['h-new', 'h-same']);
    expect(result.summary).toEqual({ addedRhinestone: 1, addedHtv: 1, addedPapercraft: 0, updatedRhinestone: 1, updatedHtv: 0, updatedPapercraft: 0, keptNewer: 2, addedCalibration: 0, updatedCalibration: 0 });
    expect(result.rhinestoneToSave.map((d) => d.templateId).sort()).toEqual(['new', 'newer']);
  });

  it('restoring the same backup twice changes nothing the second time', () => {
    const first = mergeWorkspaceBackup(existing, backup);
    const second = mergeWorkspaceBackup(first, backup);
    expect(second.summary.addedRhinestone + second.summary.addedHtv + second.summary.updatedRhinestone + second.summary.updatedHtv).toBe(0);
    expect(second.rhinestoneToSave).toEqual([]);
  });

  it('describes what happened in one sentence', () => {
    expect(describeMergeSummary({ addedRhinestone: 2, addedHtv: 1, addedPapercraft: 0, updatedRhinestone: 0, updatedHtv: 0, updatedPapercraft: 0, keptNewer: 1, addedCalibration: 0, updatedCalibration: 0 }, 0)).toBe('Restored: added 3 designs, kept 1 that is already up to date here.');
    expect(describeMergeSummary({ addedRhinestone: 0, addedHtv: 0, addedPapercraft: 0, updatedRhinestone: 0, updatedHtv: 0, updatedPapercraft: 0, keptNewer: 0, addedCalibration: 0, updatedCalibration: 0 }, 0)).toBe('The backup had no designs in it.');
    expect(describeMergeSummary({ addedRhinestone: 1, addedHtv: 0, addedPapercraft: 0, updatedRhinestone: 1, updatedHtv: 0, updatedPapercraft: 0, keptNewer: 0, addedCalibration: 0, updatedCalibration: 0 }, 2)).toContain('skipped 2');
  });

  it('carries calibration profiles in the backup, merges them by age, and skips a damaged one (plan F7)', () => {
    const profile = (id: string, updatedAt: string, hole = 3.5) => ({
      id, name: `Profile ${id}`, materialProfileId: 'magic-flock-cricut-maker', createdAt: '2026-01-01T00:00:00Z', updatedAt,
      approvedAt: '2026-01-02T00:00:00Z', overrides: [{ stoneSize: 'SS10', holeDiameterMm: hole }],
    });
    const backup = createWorkspaceBackup({ rhinestoneDesigns: [], htvDesigns: [], calibrationProfiles: [profile('a', '2026-03-01T00:00:00Z'), profile('b', '2026-03-01T00:00:00Z')], createdAt: '2026-03-02T00:00:00Z' });
    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(backup));
    expect(parsed.backup.calibrationProfiles).toHaveLength(2);

    const merged = mergeWorkspaceBackup({ rhinestoneDesigns: [], htvDesigns: [], calibrationProfiles: [profile('a', '2026-04-01T00:00:00Z', 3.6)] }, parsed.backup);
    expect(merged.summary).toMatchObject({ addedCalibration: 1, updatedCalibration: 0 });
    expect(merged.calibrationProfiles.find((p) => p.id === 'a')?.overrides[0]?.holeDiameterMm).toBe(3.6);
    expect(describeMergeSummary(merged.summary, 0)).toContain('restored 1 calibration profile');

    const damaged = JSON.parse(serializeWorkspaceBackup(backup)) as { calibrationProfiles: Array<{ overrides: Array<{ holeDiameterMm: number }> }> };
    damaged.calibrationProfiles[0]!.overrides[0]!.holeDiameterMm = -2;
    const reparsed = parseWorkspaceBackup(JSON.stringify(damaged));
    expect(reparsed.backup.calibrationProfiles).toHaveLength(1);
    expect(reparsed.skippedCount).toBe(1);
  });
});
