import { expect, test } from './fixtures';
import { watchErrors } from './helpers';

test('the Build view draws the parts in 3D and its canvas is drawn', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/papercraft/');
  // The Build view is for a model put together from parts: start one, then open the view.
  await page.getByText('Build your own model', { exact: true }).click();
  await page.getByRole('button', { name: 'From parts' }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  const view = page.getByRole('img', { name: /The parts in 3D/ });
  await expect(view).toBeVisible();
  const canvas = view.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(200);

  // The picture is not blank: the canvas holds more than one colour.
  const png = await canvas.screenshot();
  const colours = await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    const g = c.getContext('2d')!;
    g.drawImage(image, 0, 0, 40, 40);
    const seen = new Set<string>();
    const data = g.getImageData(0, 0, 40, 40).data;
    for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]! >> 4},${data[i + 1]! >> 4},${data[i + 2]! >> 4}`);
    return seen.size;
  }, png.toString('base64'));
  expect(colours).toBeGreaterThan(3);

  expect(errors).toEqual([]);
});
