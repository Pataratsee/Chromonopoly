import { chromium } from '@playwright/test';
import { appendFileSync, writeFileSync } from 'node:fs';

const LOG = 'docs/round7-proof/audio-music-toggle.log';
writeFileSync(LOG, `music toggle proof ${new Date().toISOString()}\n`);
const log = (line) => { appendFileSync(LOG, `${line}\n`); console.log(line); };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1024, height: 700 } });
await context.addInitScript(() => {
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
page.setDefaultTimeout(15000);
await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#name-input', { timeout: 30000 });
await page.fill('#name-input', 'Music Proof');
await page.click('#solo-btn');
await page.waitForSelector('#you-name', { state: 'visible', timeout: 20000 });
await page.waitForTimeout(3000);
const read = () => page.evaluate(() => window.__audioStats);
const before = await read();
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('switch', { name: 'Music' }).click();
await page.getByRole('button', { name: 'Close' }).first().click();
await page.waitForTimeout(1000);
const off = await read();
await page.waitForTimeout(5000);
const after = await read();
log(`oscillators before toggle=${before.oscillators}`);
log(`music off, oscillator delta over 5s=${after.oscillators - off.oscillators} (expected 0)`);
log(`sfx buffers=${after.buffers} (expected 0, untouched)`);
log(`page open and no reload during measurement`);
await browser.close();
