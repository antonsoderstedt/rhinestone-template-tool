/**
 * Runs every artwork fixture through the generators and measures the result.
 * Shared by the regression test (`tests/quality/artworkQuality.regression.test.ts`) and `npm run quality`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkExportReadiness,
  getRecommendedCenterDistance,
  measureArtworkQuality,
  scalePolylinesToFit,
  svgStringToPolylines,
  type Polyline,
  type StoneSizeId,
} from '../../src/lib/rhinestone-engine/index';
import { createPolylineFilledRhinestoneTemplate, type TemplateCoverageMode } from '../../src/lib/rhinestone-engine/fill/fillTemplate';

export const FIXTURE_ROOT = path.resolve(__dirname, '../fixtures/artwork');

export const WIDTHS_MM = [120, 240] as const;
export const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS10', 'SS16'];
export const MODES: TemplateCoverageMode[] = ['outline', 'fill', 'outline-fill', 'contour'];

/** Issue codes that mean the layout cannot be cut as it is. */
const NOT_CUTTABLE = new Set(['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP', 'NO_STONES']);

export interface Fixture {
  /** Path relative to the fixture root, e.g. `synthetic/heart.svg`. */
  name: string;
  svg: string;
  local: boolean;
}

export interface QualityRow {
  fixture: string;
  widthMm: number;
  stoneSize: StoneSizeId;
  mode: TemplateCoverageMode;
  /** `ok` or the reason the file could not be imported or generated. */
  status: string;
  stones: number;
  notCuttable: number;
  areaCoverage: number | null;
  outlineCoverage: number | null;
  outsideStones: number;
  strayStones: number;
  minGapMm: number | null;
  ms: number;
}

export function loadFixtures(root = FIXTURE_ROOT): Fixture[] {
  const fixtures: Fixture[] = [];
  const add = (dir: string, prefix: string, local: boolean) => {
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir).sort()) {
      if (!file.toLowerCase().endsWith('.svg')) continue;
      fixtures.push({ name: `${prefix}${file}`, svg: readFileSync(path.join(dir, file), 'utf8'), local });
    }
  };
  add(root, '', false);
  add(path.join(root, 'synthetic'), 'synthetic/', false);
  add(path.join(root, 'local'), 'local/', true);
  return fixtures;
}

const num = (value: number): number | null => (Number.isFinite(value) ? Number(value.toFixed(3)) : null);
const firstLine = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0]!.slice(0, 120) : String(error));

export function importFixture(fixture: Fixture): { polylines: Polyline[] } | { error: string } {
  try {
    return { polylines: svgStringToPolylines(fixture.svg, {}) };
  } catch (error) {
    return { error: firstLine(error) };
  }
}

export function runCase(
  fixture: Fixture,
  imported: { polylines: Polyline[] } | { error: string },
  widthMm: number,
  stoneSize: StoneSizeId,
  mode: TemplateCoverageMode,
): QualityRow {
  const base = { fixture: fixture.name, widthMm, stoneSize, mode };
  const empty = { stones: 0, notCuttable: 0, areaCoverage: null, outlineCoverage: null, outsideStones: 0, strayStones: 0, minGapMm: null, ms: 0 };
  if ('error' in imported) return { ...base, status: `import: ${imported.error}`, ...empty };

  const started = Date.now();
  try {
    const polylines = scalePolylinesToFit(imported.polylines, { targetWidthMm: widthMm, preserveAspectRatio: true });
    const template = createPolylineFilledRhinestoneTemplate({
      id: 'quality',
      name: 'quality',
      polylines,
      stoneSize,
      coverageMode: mode,
      fillMode: mode === 'contour' ? 'outline-fill' : mode,
    });
    const readiness = checkExportReadiness(template);
    const quality = measureArtworkQuality({
      polylines,
      stones: template.stones,
      pitchMm: getRecommendedCenterDistance(stoneSize),
    });
    return {
      ...base,
      status: 'ok',
      stones: template.stones.length,
      notCuttable: readiness.issues.filter((issue) => NOT_CUTTABLE.has(issue.code)).length,
      areaCoverage: num(quality.areaCoverage),
      outlineCoverage: num(quality.outlineCoverage),
      outsideStones: quality.outsideStones,
      strayStones: quality.strayStones,
      minGapMm: num(quality.minGapMm),
      ms: Date.now() - started,
    };
  } catch (error) {
    return { ...base, status: `generate: ${firstLine(error)}`, ...empty, ms: Date.now() - started };
  }
}

export function runMatrix(fixtures = loadFixtures()): QualityRow[] {
  const rows: QualityRow[] = [];
  for (const fixture of fixtures) {
    const imported = importFixture(fixture);
    for (const widthMm of WIDTHS_MM) {
      for (const stoneSize of STONE_SIZES) {
        for (const mode of MODES) rows.push(runCase(fixture, imported, widthMm, stoneSize, mode));
      }
    }
  }
  return rows;
}

export const rowKey = (row: Pick<QualityRow, 'fixture' | 'widthMm' | 'stoneSize' | 'mode'>) =>
  `${row.fixture}|${row.widthMm}|${row.stoneSize}|${row.mode}`;
