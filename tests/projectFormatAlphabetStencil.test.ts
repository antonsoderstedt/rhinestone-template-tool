import { describe, expect, it } from 'vitest';
import { parseRhinestoneProject, serializeRhinestoneProject, type RhinestoneProjectFile } from '../src/lib/rhinestone-engine/index';

const base = { schemaVersion: 1 as const, savedAt: '2026-11-19T12:00:00.000Z', projectName: 'Round trip' };

describe('projects made with the Alphabet and Stencils tools can be opened again', () => {
  it('round-trips an SVG alphabet project', () => {
    const project: RhinestoneProjectFile = {
      ...base,
      activeTool: 'svg-alphabet',
      generatorState: {
        generatorId: 'svg-alphabet', text: 'SULAY', stoneSize: 'SS10', svgAlphabetId: 'old-english-gothic',
        letterSpacingMm: 2, lineSpacingMm: 0, includeGuideBox: true, includeLabels: false, paddingMm: 5,
      },
    };
    expect(parseRhinestoneProject(serializeRhinestoneProject(project)).generatorState).toEqual(project.generatorState);
  });

  it('round-trips a letter stencil project', () => {
    const project: RhinestoneProjectFile = {
      ...base,
      activeTool: 'letter-stencil',
      generatorState: {
        generatorId: 'letter-stencil', sourceType: 'svg-alphabet', text: 'ABC', svgAlphabetId: 'cheer-block', rhinestoneFontId: 'trw-clean-stone',
        stoneSize: 'SS10', cardPaddingMm: 4, cardCornerRadiusMm: 2, minCardWidthMm: 20, layoutMode: 'cut-sheet', cutSheetGapMm: 3,
        includeGuideBox: false, includeLabels: false, paddingMm: 5,
      },
    };
    expect(parseRhinestoneProject(serializeRhinestoneProject(project)).generatorState).toEqual(project.generatorState);
  });

  it('still rejects bad values in them with a message that names the field', () => {
    const project = {
      ...base,
      generatorState: { generatorId: 'letter-stencil', sourceType: 'nonsense', text: 'A' },
    };
    expect(() => parseRhinestoneProject(JSON.stringify(project))).toThrow(/sourceType/);
    expect(() => parseRhinestoneProject(JSON.stringify({ ...base, generatorState: { generatorId: 'no-such-generator' } }))).toThrow(/generatorId/);
  });
});
