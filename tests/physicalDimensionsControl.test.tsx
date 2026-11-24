import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PhysicalDimensionsControl from '../app/editor/controls/PhysicalDimensionsControl';

const render = (props: Partial<Parameters<typeof PhysicalDimensionsControl>[0]>) =>
  renderToStaticMarkup(
    createElement(PhysicalDimensionsControl, {
      widthMm: 254,
      heightMm: 127,
      preserveAspectRatio: true,
      onWidthChange: vi.fn(),
      onHeightChange: vi.fn(),
      onPreserveAspectRatioChange: vi.fn(),
      ...props,
    }),
  );

describe('PhysicalDimensionsControl', () => {
  it('shows millimetres by default (the app unit) and the unit switch', () => {
    const html = render({});
    expect(html).toContain('value="254"');
    expect(html).toContain('aria-label="Unit"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>mm<\/button>/);
  });

  it('shows inches when asked, converted from the stored millimetres, with a switch', () => {
    const html = render({ unit: 'in', onUnitChange: vi.fn() });
    expect(html).toContain('value="10"');
    expect(html).toContain('value="5"');
    expect(html).toContain('aria-label="Unit"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>in<\/button>/);
  });
});
