/** @vitest-environment jsdom */

import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExportDialog, { type ExportDialogProps } from '../app/components/ExportDialog';

afterEach(cleanup);

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm" viewBox="0 0 40 20"><circle cx="5" cy="5" r="1.5"/></svg>';

function renderDialog(overrides: Partial<ExportDialogProps> = {}) {
  const onDownload = vi.fn();
  const onClose = vi.fn();
  const onCalibrate = vi.fn();
  const utils = render(
    createElement(ExportDialog, {
      open: true,
      title: 'Export SVG',
      svg: SVG,
      widthMm: 40,
      heightMm: 20,
      summaryRows: [{ label: 'Stones', value: '12' }],
      calibration: { needsCalibration: false, onCalibrate },
      defaultFilename: 'my-design',
      onDownload,
      onClose,
      ...overrides,
    }),
  );
  return { ...utils, onDownload, onClose, onCalibrate };
}

function downloadButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll('button')].find((b) => /Download/.test(b.textContent ?? ''));
  if (!button) throw new Error('Download button not found');
  return button as HTMLButtonElement;
}

describe('ExportDialog', () => {
  it('shows the size, summary rows, preview image and mat fit', () => {
    renderDialog();
    const text = document.body.textContent ?? '';
    expect(text).toContain('40.0 mm');
    expect(text).toContain('20.0 mm');
    expect(text).toContain('Stones');
    expect(text).toContain('Fits a 12 × 12 in mat.');
    const img = document.querySelector('[data-testid="export-preview"] img') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });

  it('warns when the design is larger than a 12 x 24 in mat', () => {
    renderDialog({ widthMm: 700, heightMm: 120 });
    expect(document.querySelector('[data-testid="export-mat-fit"]')?.textContent).toMatch(/Larger than a 12 × 24 in mat/);
  });

  it('downloads straight away with a sanitized file name when the material is calibrated', () => {
    const { onDownload } = renderDialog();
    expect(downloadButton().textContent).toContain('Download SVG');
    expect(downloadButton().disabled).toBe(false);

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My: Shirt?' } });
    fireEvent.click(downloadButton());

    expect(onDownload).toHaveBeenCalledWith('My-Shirt.svg', { uncalibratedOverride: false });
  });

  it('keeps the download locked for an uncalibrated material until the user acknowledges', () => {
    const { onDownload } = renderDialog({ calibration: { needsCalibration: true, onCalibrate: () => undefined } });
    expect(downloadButton().textContent).toContain('Download uncalibrated SVG');
    expect(downloadButton().disabled).toBe(true);

    fireEvent.click(downloadButton());
    expect(onDownload).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('input[type="checkbox"]') as HTMLInputElement);
    expect(downloadButton().disabled).toBe(false);

    fireEvent.click(downloadButton());
    expect(onDownload).toHaveBeenCalledWith('my-design-uncalibrated.svg', { uncalibratedOverride: true });
  });

  it('does not add a second -uncalibrated suffix when the user already typed one', () => {
    const { onDownload } = renderDialog({ calibration: { needsCalibration: true, onCalibrate: () => undefined } });
    fireEvent.change(document.querySelector('input[type="text"]') as HTMLInputElement, {
      target: { value: 'shirt-uncalibrated' },
    });
    fireEvent.click(document.querySelector('input[type="checkbox"]') as HTMLInputElement);
    fireEvent.click(downloadButton());
    expect(onDownload).toHaveBeenCalledWith('shirt-uncalibrated.svg', { uncalibratedOverride: true });
  });

  it('offers a calibrate action for an uncalibrated material', () => {
    const { onCalibrate } = renderDialog({ calibration: { needsCalibration: true, onCalibrate: () => undefined } });
    expect(onCalibrate).not.toHaveBeenCalled();
    const calibrate = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Calibrate material');
    expect(calibrate).toBeDefined();
  });

  it('disables the download while the preview is loading or has failed', () => {
    renderDialog({ svg: null, loading: true });
    expect(downloadButton().disabled).toBe(true);
    cleanup();

    renderDialog({ svg: null, error: 'Could not prepare the export.' });
    expect(downloadButton().disabled).toBe(true);
    expect(document.body.textContent).toContain('Could not prepare the export.');
  });

  it('renders studio-specific options and closes on Escape', () => {
    const { onClose } = renderDialog({ children: createElement('label', null, 'Mirror horizontally') });
    expect(document.body.textContent).toContain('Mirror horizontally');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
