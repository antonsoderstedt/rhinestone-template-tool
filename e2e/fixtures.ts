import { expect, test as base } from '@playwright/test';

/**
 * The app keeps the language and the unit on the server, so that they follow the owner between devices. Any other browser that is
 * open on the same server (a developer's own tab, a previous run) can have set them to something else, and the tests read English
 * labels in millimetres. So every test sets them first, with a time that is later than anything already stored.
 */
export const test = base.extend<{ settings: void }>({
  settings: [
    async ({ request }, use) => {
      const updatedAt = new Date().toISOString();
      for (const [id, value] of [['language', 'en'], ['unit', 'mm']] as const) {
        const response = await request.put(`/api/sync/item?kind=settings&id=${id}&updatedAt=${encodeURIComponent(updatedAt)}`, { data: JSON.stringify({ value }) });
        expect(response.status(), `setting ${id}`).toBe(200);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
