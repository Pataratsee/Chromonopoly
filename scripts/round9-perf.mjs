import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const PORT = 8793;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'docs/round9-proof/perf-low.json';
mkdirSync('docs/round9-proof', { recursive: true });

for (const suffix of ['', '-shm', '-wal']) rmSync(`/tmp/chromonopoly-perf.db${suffix}`, { force: true });
const server = spawn(process.execPath, ['dist-server/index.js'], {
  env: {
    ...process.env,
    CHROMONOPOLY_TEST: '1',
    BOTS: '0',
    CHROMONOPOLY_PORT: String(PORT),
    CHROMONOPOLY_DB: '/tmp/chromonopoly-perf.db',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
try {
  for (let i = 0; i < 60; i += 1) {
    try {
      const health = await fetch(`${BASE}/api/health`);
      if (health.ok) break;
    } catch {
      // server still compiling
    }
    if (i === 59) throw new Error(`Server did not start:\n${serverLog}`);
    await wait(250);
  }

  browser = await chromium.launch({
    headless: process.env.PERF_HEADED !== '1',
    args: ['--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${BASE}/?e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('#player-name').fill('PerfRunner');
  await page.locator('#solo-btn').click();
  await page.locator('#new-game-btn').click();
  await page.locator('#you-name').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Boolean(window.__stage && window.__renderStats));
  await page.waitForTimeout(1600);

  const cdp = await context.newCDPSession(page);
  const measure = async (label, { cpu = 1, gpuPixelRatio = 1, duration = 6000 } = {}) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.evaluate((ratio) => {
      const stage = window.__stage;
      stage.renderer.setPixelRatio(ratio);
      stage.renderer.setSize(window.innerWidth, window.innerHeight, false);
    }, gpuPixelRatio);
    await page.waitForTimeout(600);
    const frames = await page.evaluate(async (ms) => {
      const deltas = [];
      let previous = performance.now();
      await new Promise((resolve) => {
        const start = previous;
        const guard = setTimeout(resolve, ms + 2000);
        const frame = (now) => {
          deltas.push(now - previous);
          previous = now;
          if (now - start < ms) requestAnimationFrame(frame);
          else { clearTimeout(guard); resolve(); }
        };
        requestAnimationFrame(frame);
      });
      return deltas.slice(2);
    }, duration);
    const sorted = [...frames].sort((a, b) => a - b);
    const average = frames.reduce((a, b) => a + b, 0) / frames.length;
    const stats = await page.evaluate(() => window.__renderStats());
    return {
      label,
      cpuThrottle: cpu,
      gpuPixelRatio,
      samples: frames.length,
      durationMs: duration,
      averageMs: Number(average.toFixed(2)),
      fps: Number((1000 / average).toFixed(1)),
      p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
      over20ms: frames.filter((ms) => ms > 20).length,
      over33ms: frames.filter((ms) => ms > 33).length,
      render: stats,
    };
  };

  const baseline = await measure('Low · 1280x720 · unthrottled');
  const cpu4 = await measure('Low · 1280x720 · 4× CPU', { cpu: 4 });
  const gpu2 = await measure('Low · 1280x720 · 2× GPU workload', { gpuPixelRatio: Math.SQRT2 });
  const both = await measure('Low · 1280x720 · 4× CPU + 2× GPU', { cpu: 4, gpuPixelRatio: Math.SQRT2 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => {
    const stage = window.__stage;
    stage.renderer.setPixelRatio(1);
    stage.renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  const coldContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const coldPage = await coldContext.newPage();
  const coldCdp = await coldContext.newCDPSession(coldPage);
  await coldCdp.send('Network.enable');
  await coldCdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const coldStart = Date.now();
  await coldPage.goto(`${BASE}/?e2e`, { waitUntil: 'domcontentloaded' });
  await coldPage.locator('#player-name').waitFor({ state: 'visible' });
  await coldPage.locator('#player-name').fill('ColdLoad');
  await coldPage.locator('#solo-btn').click();
  await coldPage.locator('#new-game-btn').click();
  await coldPage.locator('#you-name').waitFor({ state: 'visible' });
  const coldWallMs = Date.now() - coldStart;
  const coldTiming = await coldPage.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const ready = performance.getEntriesByName('chromonopoly-ready')[0];
    return {
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      load: Math.round(nav?.loadEventEnd ?? 0),
      readyMark: Math.round(ready?.startTime ?? 0),
      now: Math.round(performance.now()),
    };
  });

  const result = {
    measuredAt: new Date().toISOString(),
    machine: process.env.HOSTNAME ?? 'local',
    viewport: '1280x720',
    quality: 'low',
    mode: 'solo table, HUD visible',
    coldLoad: { wallMs: coldWallMs, cacheDisabled: true, timing: coldTiming },
    runs: [baseline, cpu4, gpu2, both],
    errors: errors.slice(-10),
  };
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  await coldContext.close();
  await context.close();
} finally {
  if (browser) await browser.close().catch(() => undefined);
  server.kill('SIGTERM');
  await wait(300);
}
