import { chromium, firefox, webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
/**
 * Cross-browser smoke test: runs the main user flow in Chromium (installed Chrome), Firefox and WebKit (the Safari
 * engine), on desktop, iPhone, iPad, Android and a narrow Firefox window.
 *
 *   npm i --no-save playwright && npx playwright install firefox webkit
 *   npm run build && npx next start -p 3100 &        # test the production build
 *   BASE_URL=http://localhost:3100 node scripts/e2e-smoke.mjs e2e-shots [filter]
 *
 * Not part of CI (it needs browsers downloaded). `filter` is part of a configuration name, e.g. iPhone15.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const OUT = process.argv[2] || 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const matrix = [
  ['chromium-desktop', chromium, { viewport: { width: 1440, height: 900 } }],
  ['firefox-desktop', firefox, { viewport: { width: 1440, height: 900 } }],
  ['webkit-desktop(Safari engine)', webkit, { viewport: { width: 1440, height: 900 } }],
  ['webkit-iPhone15', webkit, { ...devices['iPhone 15'] }],
  ['webkit-iPadPro11', webkit, { ...devices['iPad Pro 11'] }],
  ['chromium-Pixel7', chromium, { ...devices['Pixel 7'] }],
  ['firefox-narrow390', firefox, { viewport: { width: 390, height: 844 } }],
];
const only = process.argv[3];
const results = [];
for (const [name, type, opts] of matrix) {
  if (only && !name.includes(only)) continue;
  const r = { name, steps: {}, errors: [] };
  let browser;
  try {
    browser = await type.launch(type === chromium ? { headless: true, channel: 'chrome' } : { headless: true });
    const ctx = await browser.newContext({ ...opts, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => r.errors.push('pageerror: ' + String(e.message).slice(0, 140)));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*404/.test(m.text())) r.errors.push('console: ' + m.text().slice(0, 140)); });
    const step = async (label, fn) => { try { r.steps[label] = (await fn()) ?? 'ok'; } catch (e) { r.steps[label] = 'FAIL ' + String(e.message).split('\n')[0].slice(0, 110); } };
    const mobile = (opts.viewport?.width ?? 1440) < 1024;
    await step('home', async () => { await page.goto(BASE + '/', { waitUntil: 'load' }); await page.getByRole('heading', { name: /What do you want to make/ }).waitFor({ timeout: 15000 }); });
    await step('home no hscroll', async () => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) throw new Error('scrollWidth ' + w[0] + ' > ' + w[1]); });
    await step('open studio from goal card', async () => { await page.locator('section[aria-label="Start a new design"] a').first().click(); await page.waitForURL(/\/rhinestone/, { timeout: 15000 }); await page.waitForFunction(() => document.querySelectorAll('svg circle').length > 60, null, { timeout: 40000 }); });
    let stones = 0;
    await step('stones generated', async () => { stones = await page.locator('svg circle').count(); if (stones < 50) throw new Error('only ' + stones + ' circles'); return stones + ' stones'; });
    await step('studio no hscroll', async () => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) throw new Error('scrollWidth ' + w[0] + ' > ' + w[1]); });
    await step('type new text regenerates', async () => {
      if (mobile) { await page.getByRole('button', { name: /^Design$/ }).first().click().catch(() => {}); }
      const ta = page.locator('textarea').first(); await ta.waitFor({ timeout: 8000 }); await ta.fill('SULAY'); await page.waitForTimeout(2500);
      const n = await page.locator('svg circle').count(); if (n === stones || n < 20) throw new Error('count did not change: ' + n); return stones + ' -> ' + n;
    });
    await step('export dialog + download', async () => {
      if (mobile) { await page.getByRole('button', { name: /^Export$/ }).last().click(); }
      else { await page.getByRole('button', { name: /^Export$/ }).first().click(); }
      await page.getByRole('dialog').waitFor({ timeout: 15000 });
      const cb = page.getByRole('dialog').locator('input[type=checkbox]').first(); if (await cb.count()) await cb.check();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('dialog').getByRole('button', { name: /Download/ }).click()]);
      const path = await dl.path(); const fs = await import('node:fs'); const svg = fs.readFileSync(path, 'utf8');
      const circles = (svg.match(/<circle\b/g) || []).length; const widthMm = /width="[\d.]+mm"/.test(svg); const bad = /<use\b|<image\b|<canvas\b/.test(svg);
      if (!widthMm || bad || circles < 20) throw new Error(`svg check: circles=${circles} mm=${widthMm} bad=${bad}`);
      return `${dl.suggestedFilename()} ${circles} circles, mm units`;
    });
    await step('save to My Designs and reopen', async () => {
      await page.keyboard.press('Escape').catch(() => {});
      await page.goto(BASE + '/rhinestone', { waitUntil: 'load' }); await page.waitForFunction(() => document.querySelectorAll('svg circle').length > 60, null, { timeout: 40000 });
      if (mobile) { await page.getByRole('button', { name: 'Open menu' }).first().click(); await page.getByRole('button', { name: 'Save to My Designs' }).click(); await page.waitForTimeout(800); }
      else { const save = page.getByRole('button', { name: /^Save$/ }).first(); await save.click(); await page.waitForTimeout(800); }
      await page.goto(BASE + '/designs', { waitUntil: 'load' }); await page.waitForTimeout(1500);
      const cards = await page.locator('article').count(); if (cards < 1) throw new Error('no saved design card'); return cards + ' saved';
    });
    await step('autosave restore on reload', async () => { await page.goto(BASE + '/rhinestone', { waitUntil: 'load' }); await page.waitForFunction(() => document.querySelectorAll('svg circle').length > 60, null, { timeout: 40000 }); });
    await step('HTV studio loads', async () => { await page.goto(BASE + '/htv?font=archivo-black&text=YOUR%20NAME', { waitUntil: 'load' }); await page.waitForFunction(() => document.querySelectorAll('svg path').length > 3, null, { timeout: 40000 }); });
    await step('HTV 3D tab renders or falls back', async () => { if (mobile) { await page.getByRole('button', { name: 'Open menu' }).first().click(); await page.getByRole('button', { name: '3D preview' }).click(); }
      else await page.locator('button:visible', { hasText: '3D' }).filter({ hasNotText: /Retry|Preview/ }).first().click(); await page.waitForTimeout(6000); const hasCanvas = await page.locator('canvas').count(); const fallback = await page.getByText(/3D preview|WebGL|Retry 3D|couldn/i).count(); if (!hasCanvas && !fallback) throw new Error('blank 3D area'); return hasCanvas ? 'WebGL canvas' : 'fallback message'; });
    await step('fonts page', async () => { await page.goto(BASE + '/fonts', { waitUntil: 'load' }); await page.getByRole('heading', { name: 'Fonts', exact: true }).waitFor({ timeout: 15000 }); });
    await step('setup page', async () => { await page.goto(BASE + '/setup', { waitUntil: 'load' }); await page.getByText(/Make the holes fit your stones/).waitFor({ timeout: 15000 }); });
    await page.goto(BASE + '/rhinestone', { waitUntil: 'load' }); await page.waitForFunction(() => document.querySelectorAll('svg circle').length > 60, null, { timeout: 40000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${name.replace(/[^a-z0-9]+/gi, '_')}.png` });
    await ctx.close();
  } catch (e) { r.fatal = String(e.message).split('\n')[0].slice(0, 150); }
  if (browser) await browser.close();
  results.push(r);
}
for (const r of results) {
  console.log('\n=== ' + r.name + (r.fatal ? '  FATAL ' + r.fatal : ''));
  for (const [k, v] of Object.entries(r.steps)) console.log('  ' + (String(v).startsWith('FAIL') ? '✗' : '✓') + ' ' + k + (v === 'ok' ? '' : '  — ' + v));
  const errs = [...new Set(r.errors)]; if (errs.length) { console.log('  console/page errors (' + errs.length + '):'); errs.slice(0, 5).forEach((e) => console.log('    ' + e)); }
}
