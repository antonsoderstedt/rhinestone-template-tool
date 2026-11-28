import { expect, test } from './fixtures';
import { readDownload, watchErrors } from './helpers';

/** The drawing tool, with a real mouse: draw a square, put points on its sides, choose two and take them away. */
test('draw, add points, choose several and take them away', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/papercraft/draw/');
  await page.getByRole('button', { name: 'Outline', exact: true }).waitFor();

  // Snapping off, so that the corners are exactly where the mouse is.
  await page.locator('select').filter({ has: page.locator('option', { hasText: '5 mm' }) }).selectOption({ label: 'Off' });

  // The sheet is the biggest white area in the work space; draw in its middle.
  const sheet = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('svg')].map((s) => s.getBoundingClientRect()).filter((r) => r.width > 300);
    const b = boxes.sort((a, c) => c.width * c.height - a.width * a.height)[0]!;
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  const cx = sheet.x + sheet.w / 2;
  const cy = sheet.y + sheet.h / 2;
  const half = Math.min(sheet.w, sheet.h) / 6;
  const [l, r, t, b] = [cx - half, cx + half, cy - half, cy + half];

  // Choose the tool and wait for its hint: the first click must not come before the page is ready for it.
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  await expect(page.getByText(/Click the corners of a part/)).toBeVisible();

  const mouse = page.mouse;
  for (const [x, y] of [[l, t], [r, t], [r, b], [l, b], [l, t]]) await mouse.click(x!, y!);

  await page.getByRole('button', { name: 'Add a point', exact: true }).click();
  await mouse.move(cx, t);
  await mouse.click(cx, t); // on the top side
  await mouse.click(r, cy); // on the right side

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.keyboard.down('Shift');
  await mouse.click(cx, t);
  await mouse.click(r, cy);
  await page.keyboard.up('Shift');
  await expect(page.getByText('2 points chosen')).toBeVisible();

  const save = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a file', exact: true }).click()]);
    const file = JSON.parse(await readDownload(download)) as { kind: string; doc: { items: { points: number[][]; closed: boolean }[] } };
    expect(file.kind).toBe('papercraft-drawing');
    return file.doc.items[0]!;
  };
  const chooseTwo = async () => {
    await page.keyboard.down('Shift');
    await mouse.click(cx, t);
    await mouse.click(r, cy);
    await page.keyboard.up('Shift');
    await expect(page.getByText('2 points chosen')).toBeVisible();
  };

  // Delete takes both chosen points away at once; the square keeps its four corners.
  await page.keyboard.press('Delete');
  await expect(page.getByText('2 points chosen')).toBeHidden();
  const square = await save();
  expect(square.closed).toBe(true);
  expect(square.points).toHaveLength(4);

  // One undo brings both points back (the square had its four corners and the two new points).
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  expect((await save()).points).toHaveLength(6);

  // The same with the button of the choice bar.
  await chooseTwo();
  await page.getByRole('button', { name: 'Take them away' }).click();
  expect((await save()).points).toHaveLength(4);

  expect(errors).toEqual([]);
});
