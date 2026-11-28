import { expect, test } from './fixtures';
import { readDownload, watchErrors } from './helpers';

/** An HTV design is saved as a `.htv.json` file and opens again with the same layers. */
test('save the design file and open it again', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/htv/');
  await page.getByRole('button', { name: 'Hexagon', exact: true }).click();
  await page.getByRole('button', { name: 'Heart', exact: true }).click();

  const saveFile = async () => {
    // The button is in a section that is folded away until it is opened.
    if (!(await page.getByRole('button', { name: 'Save design file', exact: true }).isVisible())) await page.getByText('Save the design', { exact: true }).click();
    const button = page.getByRole('button', { name: 'Save design file', exact: true });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toMatch(/\.htv\.json$/);
    return { name: download.suggestedFilename(), text: await readDownload(download) };
  };

  const first = await saveFile();
  const design = JSON.parse(first.text) as { format: string; version: number; layers: { id: string }[]; history?: unknown; selection?: unknown };
  expect(design.format).toBe('rhinestone-studio-htv-design');
  expect(design.version).toBe(1);
  expect(design.layers).toHaveLength(2);
  expect(design).not.toHaveProperty('history');

  // A fresh page has no layers; opening the file brings both back.
  await page.reload();
  await page.getByText('Save the design', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save design file', exact: true })).toBeDisabled();
  await page.locator('input[type=file]').first().setInputFiles({ name: first.name, mimeType: 'application/json', buffer: Buffer.from(first.text) });
  const second = await saveFile();
  expect((JSON.parse(second.text) as { layers: unknown[] }).layers).toHaveLength(2);

  // A damaged file is refused and leaves the design as it was.
  await page.locator('input[type=file]').first().setInputFiles({ name: 'bad.htv.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"rhinestone-studio-htv-design","version":1,"layers":"nope"}') });
  expect((JSON.parse((await saveFile()).text) as { layers: unknown[] }).layers).toHaveLength(2);

  expect(errors).toEqual([]);
});
