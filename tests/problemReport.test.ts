import { describe, expect, it } from 'vitest';
import { MAX_ATTACHED_DESIGN_BYTES, PROBLEM_REPORT_KIND, buildProblemReport, problemReportFilename } from '../app/lib/problemReport';

const base = { description: '  stones vanish  ', page: '/rhinestone', userAgent: 'UA', language: 'sv-SE', screen: { width: 1280, height: 800 }, createdAt: '2026-11-22T10:00:00Z' };

describe('problem report (plan H6)', () => {
  it('has the description and the environment, and no design unless attached', () => {
    const { text, designAttached } = buildProblemReport({ ...base, designJson: null });
    const report = JSON.parse(text);
    expect(report.kind).toBe(PROBLEM_REPORT_KIND);
    expect(report.description).toBe('stones vanish');
    expect(report.environment).toEqual({ page: '/rhinestone', userAgent: 'UA', language: 'sv-SE', screen: { width: 1280, height: 800 } });
    expect(report.design).toBeNull();
    expect(designAttached).toBe(false);
  });

  it('attaches the design when given, as data, not as text', () => {
    const result = buildProblemReport({ ...base, designJson: '{"projectName":"Mia"}' });
    expect(JSON.parse(result.text).design).toEqual({ projectName: 'Mia' });
    expect(result.designAttached).toBe(true);
  });

  it('leaves out a design that is too big or not JSON, and says so', () => {
    const big = buildProblemReport({ ...base, designJson: ' '.repeat(MAX_ATTACHED_DESIGN_BYTES + 1) });
    expect(big).toMatchObject({ designAttached: false, designSkipped: true });
    expect(buildProblemReport({ ...base, designJson: 'not json' }).designSkipped).toBe(true);
  });

  it('is the same for the same input and names the file by day', () => {
    expect(buildProblemReport({ ...base, designJson: null }).text).toBe(buildProblemReport({ ...base, designJson: null }).text);
    expect(problemReportFilename('2026-11-22T10:00:00Z')).toBe('rhinestone-studio-problem-2026-11-22.json');
  });

  it('cuts a very long description', () => {
    expect(JSON.parse(buildProblemReport({ ...base, description: 'x'.repeat(9000), designJson: null }).text).description).toHaveLength(5000);
  });
});
