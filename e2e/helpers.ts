import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Collects what a page throws or logs as an error; a test asserts that it is empty. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Only two failed requests are not a fault of the page: the favicon, and the owner's libraries (which exist on one computer and
    // not in CI). A missing script, style or any other file still fails the test.
    const url = m.location().url;
    if (/\/favicon\.[a-z]+$/.test(url) || /\/(design-library|font-library)\//.test(url)) return;
    errors.push(`console: ${text.slice(0, 200)}${url ? ` (${url})` : ''}`);
  });
  return errors;
}

/** Reads a download as text. */
export async function readDownload(download: { path(): Promise<string | null> }): Promise<string> {
  const path = await download.path();
  if (!path) throw new Error('The download has no file.');
  return readFileSync(path, 'utf8');
}

/** Types a name in the Rhinestone studio, waits for the stones and downloads the SVG. */
export async function exportRhinestoneSvg(page: Page, name = 'SULAY'): Promise<string> {
  await page.goto('/rhinestone/');
  const textarea = page.locator('textarea').first();
  await textarea.fill(name);
  await expect.poll(() => page.locator('svg circle').count(), { timeout: 30_000 }).toBeGreaterThan(20);
  await page.getByRole('button', { name: /^Export$/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const checkbox = dialog.locator('input[type=checkbox]').first();
  if (await checkbox.count()) await checkbox.check();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /^Download (uncalibrated )?SVG$/ }).click()]);
  return readDownload(download);
}
