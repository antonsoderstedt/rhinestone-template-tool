import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExportReadinessPanel from '../app/components/ExportReadinessPanel';
import { checkExportReadiness, createStoneGridTemplate } from '../src/lib/rhinestone-engine/index';

describe('ExportReadinessPanel', () => {
  const readiness = checkExportReadiness(
    createStoneGridTemplate({
      id: 'panel-calibration-grid',
      name: 'Panel calibration grid',
      stoneSize: 'SS10',
      columns: 5,
      rows: 3,
    }),
    { approvedCalibrationProfile: null },
  );

  it('shows the calibration export step by default', () => {
    const html = renderToStaticMarkup(
      createElement(ExportReadinessPanel, {
        result: readiness,
      }),
    );
    expect(html).toContain('Export step — calibration required');
  });

  it('hides the calibration export step inside setup/calibration flows', () => {
    const html = renderToStaticMarkup(
      createElement(ExportReadinessPanel, {
        result: readiness,
        showCalibrationStep: false,
      }),
    );
    expect(html).not.toContain('Export step — calibration required');
  });
});
