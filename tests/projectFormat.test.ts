import { describe, it, expect } from 'vitest';
import {
  LEGACY_OUTLINE_FONT_ID,
  parseRhinestoneProject,
  serializeRhinestoneProject,
  type RhinestoneProjectFile,
} from '../src/lib/rhinestone-engine/index';

describe('Project format — parseRhinestoneProject', () => {
  it('parses a valid outline-text project', () => {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Test Outline Text SS10',
      exportSettings: undefined,
      editableState: undefined,
      activeTool: undefined,
      manualToolState: undefined,
      generatorState: {
        generatorId: 'outline-text',
        text: 'SMOOCH',
        stoneSize: 'SS10',
        outlineTextStyle: 'outline',
        fontId: LEGACY_OUTLINE_FONT_ID,
        fontSizeMm: 25,
        targetWidthMm: 100,
        targetHeightMm: null,
        preserveAspectRatio: true,
        align: 'left',
        letterSpacingMm: 2,
        lineSpacingMm: 8,
        coverageMode: 'outline',
        fillMode: 'outline',
        fillPattern: 'offset-grid',
        placementPattern: 'default',
        contourSettings: undefined,
        radialSettings: undefined,
        densityPreset: 'standard',
        customSpacingMm: 4.0,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
      },
    };
    const json = serializeRhinestoneProject(project);
    const parsed = parseRhinestoneProject(json);
    expect(parsed).toEqual(project);
  });

  it('migrates legacy outline-text projects without fontId to the original vector font', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Legacy Outline Text',
      generatorState: {
        generatorId: 'outline-text',
        text: 'SMOOCH',
        stoneSize: 'SS10',
        fontSizeMm: 25,
        targetWidthMm: null,
        targetHeightMm: null,
        preserveAspectRatio: true,
        align: 'left',
        letterSpacingMm: 2,
        lineSpacingMm: 8,
        fillMode: 'outline',
        fillPattern: 'offset-grid',
        densityPreset: 'standard',
        customSpacingMm: 4,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
      },
    });

    const parsed = parseRhinestoneProject(json);
    expect(parsed.generatorState.generatorId).toBe('outline-text');
    if (parsed.generatorState.generatorId === 'outline-text') {
      expect(parsed.generatorState.fontId).toBe(LEGACY_OUTLINE_FONT_ID);
      expect(parsed.generatorState.outlineTextStyle).toBe('outline');
    }
  });

  it('infers filled typography for legacy outline-text projects with fill placement', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Legacy Filled Outline Text',
      generatorState: {
        generatorId: 'outline-text',
        text: 'SMOOCH',
        stoneSize: 'SS10',
        fontId: 'archivo-black',
        fontSizeMm: 25,
        targetWidthMm: null,
        targetHeightMm: null,
        preserveAspectRatio: true,
        align: 'left',
        letterSpacingMm: 2,
        lineSpacingMm: 8,
        coverageMode: 'fill',
        fillMode: 'fill',
        fillPattern: 'offset-grid',
        densityPreset: 'standard',
        customSpacingMm: 4,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
      },
    });

    const parsed = parseRhinestoneProject(json);
    expect(parsed.generatorState.generatorId).toBe('outline-text');
    if (parsed.generatorState.generatorId === 'outline-text') {
      expect(parsed.generatorState.outlineTextStyle).toBe('filled-typography');
    }
  });

  it('parses a manual-editor project with stones', () => {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Manual Editor 3 stones',
      generatorState: {
        generatorId: 'manual-editor',
        stones: [
          { id: 'manual-0', x: 10, y: 10, stoneSize: 'SS10', holeDiameterMm: 3.0 },
          { id: 'manual-1', x: 20, y: 10, stoneSize: 'SS10', holeDiameterMm: 3.0 },
          { id: 'manual-2', x: 15, y: 20, stoneSize: 'SS10', holeDiameterMm: 3.0 },
        ],
        includeGuideBox: true,
        paddingMm: 5,
      },
    };
    const json = serializeRhinestoneProject(project);
    const parsed = parseRhinestoneProject(json);
    expect(parsed).toEqual(project);
  });

  it('parses dot-matrix-text with all layout v2 fields', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Dot Matrix Test',
      generatorState: {
        generatorId: 'dot-matrix-text',
        text: 'HELLO',
        stoneSize: 'SS6',
        includeGuideBox: false,
        includeLabels: true,
        paddingMm: 3,
        densityPreset: 'dense',
        customSpacingMm: 3.5,
        targetWidthMm: 50,
        targetHeightMm: 30,
        preserveAspectRatio: false,
        align: 'center',
        letterSpacingColumns: 2,
        lineSpacingRows: 3,
      },
    });
    const parsed = parseRhinestoneProject(json);
    expect(parsed.generatorState.generatorId).toBe('dot-matrix-text');
    if (parsed.generatorState.generatorId === 'dot-matrix-text') {
      expect(parsed.generatorState.text).toBe('HELLO');
      expect(parsed.generatorState.align).toBe('center');
    }
  });

  it('rejects invalid JSON', () => {
    expect(() => parseRhinestoneProject('not json')).toThrow('Invalid file');
  });

  it('rejects incompatible schema version', () => {
    const json = JSON.stringify({
      schemaVersion: 999,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Bad Version',
      generatorState: { generatorId: 'manual-grid', stoneSize: 'SS10', columns: 5, rows: 3, includeGuideBox: true, includeLabels: false, paddingMm: 5, densityPreset: 'standard', customSpacingMm: 4 },
    });
    expect(() => parseRhinestoneProject(json)).toThrow('Incompatible project file');
  });

  it('rejects missing generatorId', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'No Generator',
      generatorState: { text: 'HELLO' },
    });
    expect(() => parseRhinestoneProject(json)).toThrow('generatorId must be one of');
  });

  it('rejects invalid stone size', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Bad Stone Size',
      generatorState: {
        generatorId: 'manual-grid',
        stoneSize: 'SS99',
        columns: 5,
        rows: 3,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
        densityPreset: 'standard',
        customSpacingMm: 4,
      },
    });
    expect(() => parseRhinestoneProject(json)).toThrow('stoneSize must be one of');
  });

  it('ignores unknown top-level fields (forward-compatible)', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Future Field Test',
      futureField: 'will be ignored',
      generatorState: {
        generatorId: 'manual-grid',
        stoneSize: 'SS10',
        columns: 5,
        rows: 3,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
        densityPreset: 'standard',
        customSpacingMm: 4,
      },
    });
    expect(() => parseRhinestoneProject(json)).not.toThrow();
  });
});

describe('Project format — serializeRhinestoneProject', () => {
  it('produces valid JSON', () => {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Serialize Test',
      generatorState: {
        generatorId: 'manual-grid',
        stoneSize: 'SS10',
        columns: 5,
        rows: 3,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
        densityPreset: 'standard',
        customSpacingMm: 4,
      },
    };
    const json = serializeRhinestoneProject(project);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips without loss', () => {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Round Trip Test',
      exportSettings: undefined,
      editableState: undefined,
      activeTool: undefined,
      manualToolState: undefined,
      generatorState: {
        generatorId: 'svg-upload',
        assetKind: 'svg',
        uploadedSvgText: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>',
        imageFileName: null,
        dimensionUnit: 'mm',
        imageColorCount: 1,
        imageThreshold: 128,
        imageDetail: 128,
        imageInvert: false,
        stoneSize: 'SS12',
        includeGuideBox: false,
        includeLabels: true,
        paddingMm: 8,
        targetWidthMm: 120,
        targetHeightMm: 80,
        preserveAspectRatio: false,
        coverageMode: 'outline',
        densityPreset: 'loose',
        customSpacingMm: 5.5,
        cleanupEnabled: true,
        cleanupSimplify: true,
        cleanupSimplifyTol: 0.5,
        cleanupRemoveTiny: false,
        cleanupMinLength: 2,
        cleanupRemoveDups: true,
        cleanupDupTol: 0.1,
        fillMode: 'fill',
        fillPattern: 'grid',
        placementPattern: 'default',
        contourSettings: undefined,
        radialSettings: undefined,
      },
    };
    const json = serializeRhinestoneProject(project);
    const parsed = parseRhinestoneProject(json);
    expect(parsed).toEqual(project);
  });

  it('parses rhinestone-font projects with presentation mode', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Rhinestone Font Mode',
      generatorState: {
        generatorId: 'rhinestone-font-line',
        presentationMode: 'line',
        text: 'CHEER',
        stoneSize: 'SS10',
        rhinestoneFontId: 'small-line-ss10',
        targetStoneSizeMm: 3.429,
        letterSpacingMm: 0,
        lineSpacingMm: 0,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
      },
    });
    const parsed = parseRhinestoneProject(json);
    expect(parsed.generatorState.generatorId).toBe('rhinestone-font-line');
    if (parsed.generatorState.generatorId === 'rhinestone-font-line') {
      expect(parsed.generatorState.presentationMode).toBe('line');
    }
  });
});
