import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { watchErrors } from './helpers';

/**
 * Stone generation is asynchronous: a font has to be loaded before its text can be turned into stones. When the settings change
 * again while an earlier request is still waiting, the earlier one must not overwrite the newer one when it finally finishes
 * (ADR 0070). Here the answer for the first font is held back by the browser's network layer until the second font has produced
 * its design; releasing the first must leave the second design on the canvas.
 */
const FONT_FILES: Record<string, string> = {
  'archivo-black': 'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
  'oswald-condensed': 'node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff',
};

test('a font that answers late does not overwrite the design of the font chosen after it', async ({ page }) => {
  const errors = watchErrors(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let heldRequests = 0;

  await page.route('**/api/outline-fonts/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    const file = FONT_FILES[id];
    if (!file) return route.fallback(); // every other font: the real server answers
    if (id === 'archivo-black') {
      heldRequests += 1;
      await held; // the first font answers only when the test lets it
    }
    await route.fulfill({ status: 200, contentType: 'font/woff', body: readFileSync(file) });
  });

  await page.goto('/rhinestone/');
  await page.getByRole('navigation', { name: 'Studio tools' }).getByRole('button', { name: 'Text', exact: true }).click();
  await page.locator('textarea').first().fill('HELLO');
  const stones = () => page.locator('svg circle').count();
  await expect.poll(stones).toBeGreaterThan(5);

  // Choose the slow font: its request is now waiting. Then choose the fast one: it finishes first.
  await page.getByRole('button', { name: /^Archivo Black/ }).click();
  await expect.poll(() => heldRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: /^Oswald/ }).click();

  // Oswald's design is on the canvas, and stays the same for a while.
  await expect.poll(async () => {
    const first = await stones();
    await page.waitForTimeout(400);
    return first === (await stones()) ? first : -1;
  }, { timeout: 20_000 }).toBeGreaterThan(5);
  const oswald = await stones();

  // Let the slow font answer. Its (now outdated) request finishes, and must change nothing.
  release();
  await page.waitForTimeout(2500);
  expect(await stones()).toBe(oswald);
  await expect(page.getByRole('button', { name: /^Oswald/ })).toHaveAttribute('aria-pressed', 'true');

  // Control: the slow font's own design really is different, so the test could have failed.
  await page.getByRole('button', { name: /^Archivo Black/ }).click();
  await expect.poll(async () => (await stones()) !== oswald ? 'different' : 'same', { timeout: 20_000 }).toBe('different');

  expect(errors).toEqual([]);
});
