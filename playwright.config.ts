import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests (ADR 0068). They run against the real static build served by the real Worker on a local D1
 * (`scripts/deploy-private.sh --dev`: no login, a fresh database on every start). Locally the installed Chrome is used
 * (`E2E_CHANNEL=chrome npm run test:e2e`); CI installs Playwright's Chromium.
 */
const PORT = 8787;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // one local database: the tests share it, so they run one after another
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_CHANNEL || undefined,
    locale: 'en-US', // the app starts in the browser's language; the tests use the English labels
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    // Headless Chromium on a CI machine has no GPU: draw WebGL (the 3D views) in software.
    launchOptions: process.env.CI ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'scripts/deploy-private.sh --dev',
    url: `http://localhost:${PORT}/api/site/meta`,
    reuseExistingServer: !process.env.CI,
    timeout: 400_000,
  },
});
