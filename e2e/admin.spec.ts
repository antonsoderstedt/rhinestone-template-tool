import { expect, test } from './fixtures';
import { exportRhinestoneSvg, watchErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

// A run that stopped half way can leave its upload behind: take away anything this file uploaded before it starts.
test.beforeAll(async ({ request }) => {
  const library = (await (await request.get('/api/library/overlay')).json()) as { items: { design: { id: string }[] } };
  for (const item of library.items.design.filter((i) => i.id.startsWith('upload-e2e'))) await request.delete(`/api/admin/library/item?kind=design&id=${item.id}`);
});

test('the site title set in the admin panel shows on the studios', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/admin/');
  await page.getByRole('tab', { name: 'Site text' }).click();
  await page.getByLabel('Site title', { exact: true }).fill('My own studio');
  await page.getByLabel('HTV Studio title').fill('My HTV');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible();

  await page.goto('/papercraft/');
  await expect.poll(() => page.title()).toBe('My own studio');
  await page.goto('/htv/');
  await expect.poll(() => page.title()).toBe('My HTV');

  // Put the original text back, so the other tests and a later run start as the site does.
  await page.goto('/admin/');
  await page.getByRole('tab', { name: 'Site text' }).click();
  await page.getByRole('button', { name: 'Use the original text' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible();
  await page.goto('/htv/');
  await expect.poll(() => page.title()).toBe('Rhinestone Template Tool');
  expect(errors).toEqual([]);
});

test('upload a design to the library, hide it, and delete it', async ({ page }) => {
  const svg = await exportRhinestoneSvg(page, 'E2E');
  const errors = watchErrors(page);
  page.on('dialog', (dialog) => void dialog.accept());

  await page.goto('/admin/');
  await page.getByRole('tab', { name: 'Libraries' }).click();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'e2e-upload.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.getByRole('button', { name: /^Upload 1 file/ }).click();
  await expect(page.getByLabel(/^Select e2e.?upload/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Uploaded', { exact: true }).first()).toBeVisible();

  // It is stored in the database: the Worker lists it with its stones counted.
  const library = (await (await page.request.get('/api/library/overlay')).json()) as { items: { design: { id: string; design: { stones: number } }[] } };
  const uploaded = library.items.design.find((i) => i.id.startsWith('upload-e2e-upload'))!;
  expect(uploaded.design.stones).toBeGreaterThan(20);
  const file = await page.request.get(`/api/library/file?kind=design&id=${uploaded.id}`);
  expect(file.status()).toBe(200);

  // Hide, show, then delete for good.
  await page.getByRole('button', { name: /^Hide e2e.?upload/i }).click();
  await expect(page.getByRole('button', { name: /^Show e2e.?upload/i })).toBeVisible();
  await page.getByRole('button', { name: /^Show e2e.?upload/i }).click();
  await page.getByRole('button', { name: /^Delete e2e.?upload/i }).click();
  await expect(page.getByLabel(/^Select e2e.?upload/i)).toBeHidden();
  expect((await page.request.get(`/api/library/file?kind=design&id=${uploaded.id}`)).status()).toBe(404);
  expect(errors).toEqual([]);
});

test('statistics count a visit', async ({ page }) => {
  await page.goto('/htv/');
  await page.waitForTimeout(1500); // the visit is sent a moment after the page has opened
  await page.goto('/admin/');
  const stats = (await (await page.request.get('/api/admin/stats?days=1')).json()) as { totals: { pageViews: number } };
  expect(stats.totals.pageViews).toBeGreaterThan(0);
});
