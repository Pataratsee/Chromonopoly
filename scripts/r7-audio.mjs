import { chromium } from '@playwright/test';
import { appendFileSync, writeFileSync } from 'node:fs';

const LOG = 'docs/round7-proof/audio-10min.log';
writeFileSync(LOG, `round7 audio proof started ${new Date().toISOString()}\n`);
const log = (line) => { appendFileSync(LOG, line + '\n'); console.log(line); };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 700 } });
await context.addInitScript(() => {
  try {
    localStorage.setItem('chromonopoly.settings', JSON.stringify({
      sfxOn: false, musicOn: true, quality: 'low', skyRunning: false, reducedMotion: true,
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
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#name-input', { timeout: 30000 });
await page.fill('#name-input', 'Audio Proof');
await page.click('#solo-btn');
await page.waitForSelector('#you-name', { state: 'visible', timeout: 20000 });
await page.waitForTimeout(1500);
const read = () => page.evaluate(() => window.__audioStats);

const start = Date.now();
let last = { oscillators: 0, buffers: 0, stops: 0 };
for (let minute = 1; minute <= 10; minute += 1) {
  const target = start + minute * 60_000;
  while (Date.now() < target) {
    const roll = page.getByRole('button', { name: /^ROLL$/i }).first();
    if (await roll.isVisible().catch(() => false) && await roll.isEnabled().catch(() => false)) {
      await roll.click().catch(() => undefined);
    }
    await page.waitForTimeout(Math.min(15_000, Math.max(250, target - Date.now())));
  }
  const stats = await read();
  log(`minute ${minute}: sfxOn=false musicOn=true buffers=${stats.buffers} (SFX must stay 0), oscillators=${stats.oscillators - last.oscillators} this minute, stops=${stats.stops}`);
  last = stats;
}
const total = await read();
log(`10-minute total: buffers=${total.buffers} (expected 0 with SFX off), oscillators=${total.oscillators} (music only), stops=${total.stops}`);
log(`elapsed=${Math.round((Date.now() - start) / 1000)}s pageErrors=${JSON.stringify(pageErrors)}`);

// Switch music off too and prove the music interval stops producing nodes.
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('switch', { name: 'Music' }).click();
await page.waitForTimeout(2000);
const before = await read();
await page.waitForTimeout(5000);
const after = await read();
log(`music off: oscillator delta over 5s = ${after.oscillators - before.oscillators} (expected 0)`);
await page.getByRole('button', { name: 'Close' }).first().click();

// SFX on briefly: a roll must create a noise buffer; toggling off must stop in-flight sources.
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('switch', { name: 'Sound effects' }).click();
await page.getByRole('button', { name: 'Close' }).first().click();
await page.getByRole('button', { name: /^ROLL$/i }).first().click();
const onStats = await read();
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('switch', { name: 'Sound effects' }).click();
const offStats = await read();
log(`sfx on roll: buffers=${onStats.buffers} (expected >0), stops after switching off=${offStats.stops - onStats.stops} (expected >0)`);
await browser.close();
log('audio proof complete');
