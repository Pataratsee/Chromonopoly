#!/usr/bin/env node
/** Measures the real production page under Fast 3G + 4x CPU and warm cache. */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const url = process.env.LOAD_URL ?? 'http://127.0.0.1:8790/?e2e';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const started = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('#player-name').waitFor({ state: 'visible', timeout: 60_000 });
const coldMs = await page.evaluate(() => Math.round(performance.getEntriesByName('chromonopoly-ready')[0]?.startTime ?? performance.now()));
const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => ({
  name: entry.name.split('/').slice(-2).join('/'),
  transfer: entry.transferSize,
  duration: Math.round(entry.duration),
})));

await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('#player-name').waitFor({ state: 'visible', timeout: 30_000 });
const warmMs = await page.evaluate(() => Math.round(performance.getEntriesByName('chromonopoly-ready')[0]?.startTime ?? performance.now()));

const report = {
  measuredAt: new Date().toISOString(),
  profile: 'Fast 3G 1.6 Mbps / 150 ms RTT / 4x CPU; warm reload unthrottled with cache',
  coldMs,
  warmMs,
  budget: { fast3g: 8000, warm: 2000 },
  wallMs: Date.now() - started,
  resources,
};
writeFileSync('docs/round11-proof/y1-fast3g-load.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ coldMs, warmMs, budget: report.budget, pass: coldMs <= 8000 && warmMs <= 2000 }, null, 2));
await browser.close();
if (coldMs > 8000 || warmMs > 2000) process.exit(1);
