import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto('http://127.0.0.1:5173/?e2e&visual', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'bob');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting') && window.__cityDebug?.ok && window.__cityDebug.loaded > 0;
}, null, { timeout: 150000 });
await page.waitForTimeout(2500);

const frames = await page.evaluate(async () => {
  const deltas = [];
  let previous = performance.now();
  await new Promise((resolve) => {
    const deadline = previous + 3000;
    const guard = setTimeout(resolve, 5000);
    const frame = (now) => {
      deltas.push(now - previous);
      previous = now;
      if (now < deadline) requestAnimationFrame(frame);
      else { clearTimeout(guard); resolve(); }
    };
    requestAnimationFrame(frame);
  });
  return deltas.slice(3);
});
const sorted = [...frames].sort((a, b) => a - b);
const average = frames.reduce((a, b) => a + b, 0) / frames.length;
const result = {
  viewport: '1920x1080',
  city: await page.evaluate(() => window.__cityDebug),
  samples: frames.length,
  averageMs: Number(average.toFixed(2)),
  fps: Number((1000 / average).toFixed(1)),
  p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
  longFrames: frames.filter((ms) => ms > 20).length,
  over33ms: frames.filter((ms) => ms > 33).length,
  errors: errors.slice(-5),
};
writeFileSync('docs/round7-proof/perf-city.log', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
await browser.close();
