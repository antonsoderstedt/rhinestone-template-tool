import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StudioError from '../app/components/StudioError';

describe('StudioError', () => {
  const error = Object.assign(new Error('boom'), { digest: 'x' });

  it('says saved designs were not touched and shows the message', () => {
    const html = renderToStaticMarkup(createElement(StudioError, { studioName: 'Rhinestone Studio', error, onRetry: () => undefined }));
    expect(html).toContain('The Rhinestone Studio stopped working');
    expect(html).toContain('were not touched');
    expect(html).toContain('boom');
    expect(html).toContain('Try again');
    expect(html).not.toContain('Open without the last session');
  });

  it('offers to open without the last session only for a studio with an autosave', () => {
    const html = renderToStaticMarkup(createElement(StudioError, { studioName: 'Rhinestone Studio', error, onRetry: () => undefined, hasAutosave: true }));
    expect(html).toContain('Open without the last session');
    expect(html).toContain('kept aside, not deleted');
  });
});
