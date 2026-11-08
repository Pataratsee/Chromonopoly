import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 700 } });
await context.addInitScript(() => {
  try {
    localStorage.setItem('chromonopoly.settings', JSON.stringify({
      sfxOn: true, musicOn: false, quality: 'low', skyRunning: false, reducedMotion: true,
    }));
  } catch {}
  const stats = { oscillators: 0, buffers: 0, stops: 0 };
  window.__audioStats = stats;
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    createOscillator() { stats.oscillators += 1; return super.createOscillator(); }
    createBufferSource() { stats.buffers += 1; return super.createBufferSource(); }
  };
  const originalStop = AudioScheduledSourceNode.prototype.stop;
  AudioScheduledSourceNode.prototype.stop = function (...args) {
    stats.stops += 1;
    return originalStop.apply(this, args);
  };
});
const page = await context.newPage();
await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#name-input', { timeout: 30000 });
await page.fill('#name-input', 'Audio Toggle');
await page.click('#solo-btn');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 20000 });
await page.waitForTimeout(1000);
const read = () => page.evaluate(() => window.__audioStats);
const before = await read();
await page.getByRole('button', { name: /^ROLL$/ }).first().click();
const during = await read();
await page.evaluate(() => {
  const settings = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').trim() === 'Settings');
  settings?.click();
  const sw = [...document.querySelectorAll('[role="switch"]')].find((s) => (s.getAttribute('aria-label') ?? '').includes('Sound effects'));
  if (sw && sw.getAttribute('aria-checked') === 'true') sw.click();
});
const after = await read();
const result = [
  `buffers created by roll: ${during.buffers - before.buffers}`,
  `stops while toggling off in flight: ${after.stops - during.stops}`,
  `SFX switch off: ${await page.getByRole('switch', { name: 'Sound effects' }).getAttribute('aria-checked')}`,
  `stats before=${JSON.stringify(before)} during=${JSON.stringify(during)} after=${JSON.stringify(after)}`,
].join('\n');
writeFileSync('docs/round7-proof/audio-toggle.log', result + '\n');
console.log(result);
await browser.close();
