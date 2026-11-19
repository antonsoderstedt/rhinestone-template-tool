import { describe, expect, it } from 'vitest';
import { generateAndResolveTemplate } from '../app/editor/generateAndResolveTemplate';
import {
  LEGACY_OUTLINE_FONT_ID,
  checkExportReadiness,
  createOutlineTextTemplateAsync,
} from '../src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate } from '../src/lib/rhinestone-engine/index';

const WORD_ACCEPTANCE_CASES = [
  'SMOOCH',
  'SCORE 2026',
  'Sulay 123',
  'Aabcdefg',
  'Glog',
  'Hello World',
] as const;

describe('generateAndResolveTemplate', () => {
  it('keeps default SS10/25mm words export-ready with no removals', async () => {
    for (const word of WORD_ACCEPTANCE_CASES) {
      const result = await generateAndResolveTemplate({
        sourceTool: 'text',
        generateTemplate: () => createOutlineTextTemplateAsync({
          id: `word-${word}`,
          name: `Word ${word}`,
          text: word,
          stoneSize: 'SS10',
          fontId: LEGACY_OUTLINE_FONT_ID,
          fontSizeMm: 25,
          align: 'left',
          letterSpacingMm: 2,
          lineSpacingMm: 8,
          coverageMode: 'outline',
          fillMode: 'outline',
          densityPreset: 'standard',
          customSpacingMm: 4,
        }),
      });

      expect(result.template).not.toBeNull();
      const template = result.template!;
      const readiness = checkExportReadiness(template, { requireCalibration: false });
      const removedStoneCount = result.spacingAdjustment?.removedStoneCount ?? 0;
      const movedStoneCount = result.spacingAdjustment?.movedStoneCount ?? 0;

      process.stdout.write(
        `[word-ac] ${word}: stones=${template.stones.length}, movedStoneCount=${movedStoneCount}, removedStoneCount=${removedStoneCount}\n`,
      );

      expect(readiness.ready).toBe(true);
      expect(removedStoneCount).toBe(0);
    }
  });

  it('does not auto-resolve imported templates and returns them unchanged', async () => {
    const imported: RhinestoneTemplate = {
      id: 'imported-tight-gap',
      name: 'Imported Tight Gap',
      unit: 'mm',
      source: 'user',
      stones: [
        { id: 'a', stoneSize: 'SS10', holeDiameterMm: 3.0, center: { x: 0, y: 0 } },
        { id: 'b', stoneSize: 'SS10', holeDiameterMm: 3.0, center: { x: 3.35, y: 0 } },
      ],
    };

    const result = await generateAndResolveTemplate({
      sourceTool: 'template-import',
      generateTemplate: () => imported,
    });

    expect(result.template).toEqual(imported);
    expect(result.spacingAdjustment).toBeNull();
    const tightGapIssue = result.validation?.issues.find((issue) => issue.code === 'STONE_TIGHT_GAP');
    expect(tightGapIssue?.measuredGapMm).toBeCloseTo(0.35, 3);
    expect(tightGapIssue?.requiredGapMm).toBeCloseTo(0.508, 3);
  });
});

describe('stone fonts with overlapping dots', () => {
  const overlapping = {
    id: 'rhinestone-font-preview',
    name: 'Font',
    unit: 'mm' as const,
    source: 'vendor' as const,
    widthMm: 12,
    heightMm: 9,
    stones: Array.from({ length: 30 }, (_, i) => ({
      id: `rf-${i}`,
      center: { x: 5 + (i % 6) * 1.6, y: 5 + Math.floor(i / 6) * 1.6 },
      stoneSize: 'SS10' as const,
      holeDiameterMm: 3.429,
    })),
  };

  it('enlarges the layout instead of discarding stones, and reports the factor', async () => {
    const result = await generateAndResolveTemplate({ sourceTool: 'rhinestone-font', generateTemplate: () => overlapping });
    expect(result.template?.stones).toHaveLength(30);
    expect(result.spacingAdjustment?.enlargedByFactor).toBeGreaterThan(2);
    expect(result.validation?.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('only does this for stone fonts', async () => {
    const result = await generateAndResolveTemplate({ sourceTool: 'template-import', generateTemplate: () => overlapping });
    expect(result.spacingAdjustment).toBeNull();
    expect(result.template?.stones[1]?.center.x).toBeCloseTo(6.6, 6);
  });
});
