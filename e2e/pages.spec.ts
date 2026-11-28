import { expect, test } from './fixtures';
import { watchErrors } from './helpers';

const PAGES = ['/', '/rhinestone/', '/htv/', '/papercraft/', '/papercraft/draw/', '/fonts/', '/admin/'];

test.describe('every page opens without an error', () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main, [role=main], body').first()).toBeVisible();
      expect(await page.title()).toBe('Rhinestone Template Tool');
      expect(errors).toEqual([]);
    });
  }
});

test('the Worker routes answer on the real build', async ({ request }) => {
  for (const path of ['/api/site/meta', '/api/track/config', '/api/library/overlay', '/api/catalog/templates', '/api/sync/manifest', '/api/admin/stats']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});
