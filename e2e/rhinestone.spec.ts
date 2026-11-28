import { expect, test } from './fixtures';
import { exportRhinestoneSvg } from './helpers';

test('a name becomes stones and exports as a Cricut-safe SVG', async ({ page }) => {
  const svg = await exportRhinestoneSvg(page);
  expect((svg.match(/<circle\b/g) ?? []).length).toBeGreaterThan(20);
  expect(svg).toMatch(/<svg[^>]*\bwidth="[\d.]+mm"/);
  expect(svg).toMatch(/<svg[^>]*\bheight="[\d.]+mm"/);
  expect(svg).not.toMatch(/<use\b|<image\b|<canvas\b|<svg[^>]*>[\s\S]*<svg\b/);
});
