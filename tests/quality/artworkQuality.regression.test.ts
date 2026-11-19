import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFixtures, rowKey, runMatrix, type QualityRow } from './harness';

/**
 * The artwork generators are held to the numbers in baseline.json: a change may improve any of them, and may not make one
 * worse. After an improvement, `npm run quality -- --baseline` ratchets the file forward (review the diff).
 */
const baseline = JSON.parse(readFileSync(path.join(__dirname, 'baseline.json'), 'utf8')) as Array<Omit<QualityRow, 'ms'>>;

const COVERAGE_TOLERANCE = 0.02;

describe('artwork quality does not regress', () => {
  const rows = runMatrix(loadFixtures().filter((fixture) => !fixture.local));
  const current = new Map(rows.map((row) => [rowKey(row), row]));

  it('covers every baseline case', () => {
    const missing = baseline.map(rowKey).filter((key) => !current.has(key));
    expect(missing).toEqual([]);
  });

  it('keeps every case at least as good as the baseline', () => {
    const regressions: string[] = [];
    for (const before of baseline) {
      const now = current.get(rowKey(before));
      if (!now) continue;
      const label = rowKey(before);
      if (before.status === 'ok' && now.status !== 'ok') regressions.push(`${label}: was ok, now ${now.status}`);
      if (before.status !== 'ok' || now.status !== 'ok') continue;
      if (now.notCuttable > before.notCuttable) regressions.push(`${label}: not cuttable ${before.notCuttable} -> ${now.notCuttable}`);
      if (now.strayStones > before.strayStones) regressions.push(`${label}: strays ${before.strayStones} -> ${now.strayStones}`);
      if (now.outsideStones > before.outsideStones) regressions.push(`${label}: outside ${before.outsideStones} -> ${now.outsideStones}`);
      if (before.areaCoverage !== null && (now.areaCoverage ?? 0) < before.areaCoverage - COVERAGE_TOLERANCE) {
        regressions.push(`${label}: area ${before.areaCoverage} -> ${now.areaCoverage}`);
      }
      if (before.outlineCoverage !== null && (now.outlineCoverage ?? 0) < before.outlineCoverage - COVERAGE_TOLERANCE) {
        regressions.push(`${label}: outline ${before.outlineCoverage} -> ${now.outlineCoverage}`);
      }
    }
    expect(regressions).toEqual([]);
  });
}, 180_000);
