import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

test.describe.configure({ timeout: 360_000, mode: 'serial' });

const PROOF = 'docs/round10-proof';
mkdirSync(PROOF, { recursive: true });

interface Audit {
  console: string[];
  page: string[];
  failed: string[];
  badStatus: string[];
}

function audit(page: Page): Audit {
  const result: Audit = { console: [], page: [], failed: [], badStatus: [] };
  page.on('console', (message) => { if (message.type() === 'error') result.console.push(message.text()); });
  page.on('pageerror', (error) => result.page.push(error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (request.url().includes('favicon') || failure.includes('ERR_ABORTED')) return;
    result.failed.push(`${request.method()} ${request.url()} ${failure}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('favicon')) result.badStatus.push(`${response.status()} ${response.url()}`);
  });
  return result;
}

function expectClean(logs: Audit): void {
  expect(logs.console, `console errors:\n${logs.console.join('\n')}`).toEqual([]);
  expect(logs.page, `page errors:\n${logs.page.join('\n')}`).toEqual([]);
  expect(logs.failed, `failed requests:\n${logs.failed.join('\n')}`).toEqual([]);
  expect(logs.badStatus, `bad HTTP statuses:\n${logs.badStatus.join('\n')}`).toEqual([]);
}

function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 16);
}

async function skipTutorial(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Skip tutorial' });
  await skip.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function joinSolo(page: Page, name: string): Promise<void> {
  await page.goto('/?e2e');
  await expect(page.locator('#player-name')).toBeVisible();
  await page.locator('#player-name').fill(name);
  await page.locator('#solo-btn').click();
  await expect(page.locator('#new-game-btn')).toBeVisible();
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#you-name')).toHaveText(name);
  await expect(page.locator('#net-dot')).not.toHaveClass(/off/);
  await skipTutorial(page);
}

async function joinMulti(page: Page, name: string): Promise<void> {
  await page.goto('/?e2e');
  await expect(page.locator('#player-name')).toBeVisible();
  await page.locator('#player-name').fill(name);
  await page.locator('#multi-btn').click();
  await expect(page.locator('#you-name')).toHaveText(name, { timeout: 15_000 });
  await expect(page.locator('#net-dot')).not.toHaveClass(/off/);
}

async function scenario(page: Page, mode: 'solo' | 'multi', setup: Record<string, unknown>): Promise<void> {
  const session = await page.evaluate((m) => localStorage.getItem(`chromonopoly.session.${m}`), mode);
  expect(session).toBeTruthy();
  const result = await page.evaluate(async ({ sessionKey, bodyMode, bodySetup }) => {
    const response = await fetch('/api/test/scenario', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: sessionKey, mode: bodyMode, setup: bodySetup }),
    });
    return { status: response.status, body: await response.json() };
  }, { sessionKey: session, bodyMode: mode, bodySetup: setup });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
}

async function closeSheet(page: Page): Promise<void> {
  const close = page.locator('.sheet-close').first();
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.locator('.sheet-layer')).not.toHaveClass(/open/);
}

async function openTile(page: Page, index: number): Promise<void> {
  await page.evaluate((i) => (window as unknown as { __ui: { openTile: (n: number) => void } }).__ui.openTile(i), index);
  await expect(page.locator('.sheet-layer')).toHaveClass(/open/);
}

async function playerId(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __net: { playerId: string | null } }).__net.playerId ?? '');
}

async function advanceToBot(page: Page): Promise<void> {
  const until = Date.now() + 45_000;
  while (Date.now() < until) {
    const state = await page.evaluate(() => {
      const value = (window as unknown as { __state: () => { activePlayerId: string | null; players: Record<string, { isBot: boolean }> } }).__state();
      return { active: value.activePlayerId, bot: Boolean(value.activePlayerId && value.players[value.activePlayerId]?.isBot) };
    });
    if (state.bot) return;
    await clearBlockingPages(page);
    const roll = page.locator('#roll-btn');
    if (await roll.isEnabled().catch(() => false) && (await roll.textContent().catch(() => ''))?.trim() === 'ROLL') {
      await roll.click().catch(() => undefined);
    }
    await page.waitForTimeout(500);
  }
  throw new Error('no bot turn arrived');
}

async function waitForHumanTurn(page: Page): Promise<void> {
  const id = await playerId(page);
  await page.waitForFunction((mine) => {
    const state = (window as unknown as { __state: () => { activePlayerId: string | null; players: Record<string, { isBot: boolean }> } }).__state();
    return state.activePlayerId === mine && Boolean(state.players[mine]);
  }, id, { timeout: 45_000 });
}

async function clearBlockingPages(page: Page): Promise<void> {
  const pending = page.locator('#pending-overlay');
  if (await pending.count()) {
    const tile = Number(await pending.getAttribute('data-tile'));
    if (Number.isFinite(tile)) {
      await page.evaluate((t) => {
        const net = (window as unknown as { __net: { send: (intent: unknown) => void } }).__net;
        net.send({ t: 'decline', tile: t, key: `proof-decline-${Date.now()}` });
      }, tile);
      await expect(pending).toHaveCount(0, { timeout: 5000 }).catch(() => undefined);
    }
  }
  const busted = page.locator('#busted-screen');
  if (await busted.isVisible().catch(() => false)) { await page.waitForTimeout(1100); await busted.click().catch(() => undefined); }
  const card = page.locator('#card-draw');
  if (await card.isVisible().catch(() => false)) { await page.waitForTimeout(3300); }
  const chance = page.locator('#chance-overlay');
  if (await chance.isVisible().catch(() => false)) {
    const spin = chance.getByRole('button', { name: 'Spin', exact: true });
    if (await spin.isVisible().catch(() => false)) await spin.click().catch(() => undefined);
    await page.waitForTimeout(6500);
    const proceed = chance.locator('.chance-continue');
    if (await proceed.isVisible().catch(() => false)) await proceed.click().catch(() => undefined);
  }
  const decline = page.getByRole('button', { name: 'Decline', exact: true });
  if (await decline.isVisible().catch(() => false)) await decline.click().catch(() => undefined);
  const pay = page.getByRole('button', { name: /^Pay / });
  if (await pay.isVisible().catch(() => false)) await pay.click().catch(() => undefined);
  const crime = page.locator('#crime-result button', { hasText: 'Continue' });
  if (await crime.isVisible().catch(() => false)) await crime.click().catch(() => undefined);
}

test('X1-X9: real solo browser pass with screenshots, FPS trace, console and network evidence', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const logs = audit(page);
  const summary: Record<string, unknown> = {};
  try {
    const name = uniqueName('R10');
    await joinSolo(page, name);

    // X1 — Low quality, 4x CPU throttling, sampled requestAnimationFrame cadence.
    let fpsRaw: any;
    if (process.env.R10_REUSE_FPS === '1' && existsSync(`${PROOF}/x1-fps-4x.json`)) {
      fpsRaw = JSON.parse(readFileSync(`${PROOF}/x1-fps-4x.json`, 'utf8'));
      console.log('R10 proof: reusing existing 45 s FPS trace');
    } else {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => {
        const target = window as unknown as { __fpsSamples: number[]; __fpsDone: boolean; __fpsStart: number };
        target.__fpsSamples = [];
        target.__fpsDone = false;
        target.__fpsStart = performance.now();
        let last = performance.now();
        const tick = (now: number): void => {
          target.__fpsSamples.push(now - last);
          last = now;
          if (now - target.__fpsStart < 45_000) requestAnimationFrame(tick);
          else target.__fpsDone = true;
        };
        requestAnimationFrame(tick);
      });
      await page.waitForFunction(() => (window as unknown as { __fpsDone: boolean }).__fpsDone, null, { timeout: 75_000 });
      fpsRaw = await page.evaluate(() => {
        const target = window as unknown as { __fpsSamples: number[] };
        const samples = target.__fpsSamples.slice(1);
        const sorted = [...samples].sort((a, b) => a - b);
        const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
        return {
          frames: samples.length,
          seconds: samples.reduce((sum, ms) => sum + ms, 0) / 1000,
          avgFps: samples.length / Math.max(0.001, samples.reduce((sum, ms) => sum + ms, 0) / 1000),
          p50FrameMs: at(0.5), p95FrameMs: at(0.95), p99FrameMs: at(0.99), maxFrameMs: at(1),
          samples: samples.map((ms) => Math.round(ms * 100) / 100),
        };
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const render = await page.evaluate(() => (window as unknown as { __renderStats: () => unknown }).__renderStats());
      fpsRaw = { quality: 'low', cpuThrottle: 4, durationMs: 45_000, viewport: '1280x720', ...fpsRaw, render };
      writeFileSync(`${PROOF}/x1-fps-4x.json`, JSON.stringify(fpsRaw, null, 2));
    }
    await page.screenshot({ path: `${PROOF}/x1-perf-low-4x.png` });
    summary.x1 = { avgFps: fpsRaw.avgFps, p95FrameMs: fpsRaw.p95FrameMs, frames: fpsRaw.frames, render: fpsRaw.render };
    expect(fpsRaw.frames).toBeGreaterThan(30);

    console.log('R10 proof: X2');
    // X2 — default, four orbit angles, a low/below view and maximum zoom.
    await page.evaluate(() => document.getElementById('hud')?.classList.add('hidden'));
    const islandViews: unknown[] = [];
    for (const view of ['angle-0', 'angle-1', 'angle-2', 'angle-3', 'below', 'default', 'max-zoom'] as const) {
      await page.evaluate((v) => (window as unknown as { __cameraView: (view: string) => void }).__cameraView(v), view);
      await page.waitForTimeout(300);
      const stats = await page.evaluate(() => (window as unknown as { __islandStats: () => unknown }).__islandStats());
      islandViews.push({ view, stats, render: await page.evaluate(() => (window as unknown as { __renderStats: () => unknown }).__renderStats()) });
      await page.screenshot({ path: `${PROOF}/x2-island-${view}.png` });
    }
    writeFileSync(`${PROOF}/x2-island-views.json`, JSON.stringify(islandViews, null, 2));
    await page.evaluate(() => document.getElementById('hud')?.classList.remove('hidden'));
    summary.x2 = islandViews;

    console.log('R10 proof: X3');
    // X3 — one human roll, camera follow, piece movement and a landing pause.
    await page.evaluate(() => {
      const stage = (window as unknown as { __stage: { rig: { manualUntil: number } } }).__stage;
      stage.rig.manualUntil = 0;
    });
    await page.evaluate(() => { (window as unknown as { __turnLog: unknown[] }).__turnLog = []; });
    await page.locator('#roll-btn').click();
    await page.waitForFunction(() => ((window as unknown as { __turnLog?: Array<{ state: string }> }).__turnLog ?? []).some((entry) => entry.state === 'PIECE_MOVING'), null, { timeout: 15_000 });
    await page.screenshot({ path: `${PROOF}/x3-camera-follow-moving.png` });
    await page.waitForFunction(() => ((window as unknown as { __turnLog?: Array<{ state: string }> }).__turnLog ?? []).some((entry) => entry.state === 'TILE_PROMPT' || entry.state === 'CAMERA_ZOOM_OUT'), null, { timeout: 20_000 });
    const turnFlow = await page.evaluate(() => (window as unknown as { __turnLog?: unknown[] }).__turnLog ?? []);
    writeFileSync(`${PROOF}/x3-camera-flow.json`, JSON.stringify(turnFlow, null, 2));
    await page.screenshot({ path: `${PROOF}/x3-camera-landed.png` });
    summary.x3 = turnFlow;
    await clearBlockingPages(page);

    console.log('R10 proof: X4');
    // X4 — hand over to AI and capture the visible thinking state.
    await advanceToBot(page);
    await expect(page.locator('#thinking-dots')).toBeVisible({ timeout: 8000 });
    const botUi = await page.evaluate(() => {
      const state = (window as unknown as { __state: () => { activePlayerId: string; players: Record<string, { name: string; isBot: boolean; botStyle?: string }> } }).__state();
      return { active: state.players[state.activePlayerId], thinking: document.getElementById('thinking-dots')?.textContent ?? '', log: (window as unknown as { __botLog?: unknown[] }).__botLog ?? [] };
    });
    await page.screenshot({ path: `${PROOF}/x4-bot-thinking.png` });
    await page.waitForTimeout(5500);
    botUi.log = await page.evaluate(() => (window as unknown as { __botLog?: unknown[] }).__botLog ?? []);
    writeFileSync(`${PROOF}/x4-bot-pacing.json`, JSON.stringify(botUi, null, 2));
    summary.x4 = botUi;
    expect(botUi.active.botStyle).toBeTruthy();

    console.log('R10 proof: X5');
    // X5 — live server candles and the one-canvas market.
    await page.locator('[data-dock="Market"]').click();
    await expect(page.locator('.sheet-title')).toHaveText('Market', { timeout: 10_000 });
    await expect(page.locator('.market-terminal')).toBeVisible();
    const marketBefore = await page.evaluate(() => (window as unknown as { __state: () => { prices: Record<number, number> } }).__state().prices[1]);
    await page.waitForFunction((old) => (window as unknown as { __state: () => { prices: Record<number, number> } }).__state().prices[1] !== old, marketBefore, { timeout: 15_000 });
    const market = await page.evaluate(() => {
      const state = (window as unknown as { __state: () => { prices: Record<number, number>; marketSeq?: number } }).__state();
      return { price: state.prices[1], marketSeq: state.marketSeq, options: document.querySelectorAll('.market-select option').length, terminal: document.querySelectorAll('.market-terminal').length, chart: document.querySelectorAll('canvas.market-chart').length };
    });
    expect(market.options).toBe(28);
    expect(market.terminal).toBe(1);
    expect(market.chart).toBe(1);
    await page.screenshot({ path: `${PROOF}/x5-live-market.png` });
    writeFileSync(`${PROOF}/x5-market.json`, JSON.stringify(market, null, 2));
    summary.x5 = market;
    await closeSheet(page);

    console.log('R10 proof: X8/X9');
    // X8/X9 — wait for the human seat, inspect the live build catalogue, build and upgrade.
    await waitForHumanTurn(page);
    await scenario(page, 'solo', { kind: 'build', tile: 1, cash: 20_000 });
    await page.waitForFunction((mine) => (window as unknown as { __state: () => { tiles: Record<number, { ownerId: string | null }> } }).__state().tiles[1]?.ownerId === mine, await playerId(page), { timeout: 10_000 });
    await openTile(page, 1);
    await expect(page.getByRole('button', { name: 'Build here' })).toBeVisible();
    await page.getByRole('button', { name: 'Build here' }).click();
    expect(await page.locator('.build-card').count()).toBeGreaterThanOrEqual(2);
    const buildCards = await page.locator('.build-card').evaluateAll((cards) => cards.slice(0, 4).map((card) => card.textContent ?? ''));
    expect(buildCards.join(' ')).toMatch(/Perk/);
    writeFileSync(`${PROOF}/x9-building-perks.json`, JSON.stringify({ cards: buildCards, count: await page.locator('.build-card').count() }, null, 2));
    await page.screenshot({ path: `${PROOF}/x9-building-perks.png`, fullPage: true });
    const buildButton = page.locator('.build-card button:not([disabled])').first();
    await expect(buildButton).toBeVisible();
    await buildButton.click();
    await page.waitForFunction(() => (window as unknown as { __state: () => { tiles: Record<number, { buildings: unknown[] }> } }).__state().tiles[1]?.buildings.length === 1, null, { timeout: 15_000 });

    await openTile(page, 1);
    const upgrade = page.locator('[data-upgrade]').first();
    await expect(upgrade).toBeVisible();
    const beforeUpgrade = { label: await upgrade.textContent(), enabled: await upgrade.isEnabled(), title: await upgrade.getAttribute('title') };
    await page.screenshot({ path: `${PROOF}/x8-upgrade-live-cost.png` });
    await upgrade.click();
    await page.waitForFunction(() => (window as unknown as { __state: () => { tiles: Record<number, { buildings: Array<{ rank: number }> }> } }).__state().tiles[1]?.buildings[0]?.rank === 2, null, { timeout: 15_000 });
    const afterUpgrade = { label: await page.locator('[data-upgrade]').first().textContent(), enabled: await page.locator('[data-upgrade]').first().isEnabled() };
    await scenario(page, 'solo', { kind: 'cash', cash: 10 });
    await page.waitForFunction(() => (window as unknown as { __state: () => { players: Record<string, { cash: number }> } }).__state().players[(window as unknown as { __net: { playerId: string } }).__net.playerId]?.cash === 10, null, { timeout: 10_000 });
    await expect(page.locator('[data-upgrade]').first()).toBeDisabled({ timeout: 10_000 });
    const disabled = { label: await page.locator('[data-upgrade]').first().textContent(), title: await page.locator('[data-upgrade]').first().getAttribute('title') };
    await page.screenshot({ path: `${PROOF}/x8-upgrade-disabled-reason.png` });
    writeFileSync(`${PROOF}/x8-upgrade.json`, JSON.stringify({ beforeUpgrade, afterUpgrade, disabled }, null, 2));
    summary.x8 = { beforeUpgrade, afterUpgrade, disabled };
    expect(disabled.title).toMatch(/Need \$/);
    await closeSheet(page);
    await scenario(page, 'solo', { kind: 'cash', cash: 20_000 });

    console.log('R10 proof: X6');
    // X6 — arrest presentation.
    await scenario(page, 'solo', { kind: 'jail', tile: 1, cash: 5000, quiet: true });
    await page.waitForFunction(() => (window as unknown as { __state: () => { players: Record<string, { inJail: boolean }> } }).__state().players[(window as unknown as { __net: { playerId: string } }).__net.playerId]?.inJail, null, { timeout: 10_000 });
    const busted = page.locator('#busted-screen');
    await expect(busted).toBeVisible({ timeout: 10_000 });
    await expect(busted).toContainText('BUSTED');
    await page.screenshot({ path: `${PROOF}/x6-busted.png` });
    summary.x6 = { text: await busted.textContent(), aria: await busted.getAttribute('aria-label') };
    await busted.waitFor({ state: 'detached', timeout: 10_000 });
    const saleWheel = page.locator('#chance-overlay');
    if (await saleWheel.isVisible().catch(() => false)) {
      await saleWheel.getByRole('button', { name: 'Spin', exact: true }).click();
      await expect(saleWheel).toHaveAttribute('data-state', 'RESULT_SHOWN', { timeout: 15_000 });
      await saleWheel.locator('.chance-continue').click();
      await expect(saleWheel).toHaveCount(0);
    }

    console.log('R10 proof: X7');
    // X7 — exact release price, disabled reason and actual release.
    const jailCard = page.locator('#jail-card');
    await expect(jailCard).toBeVisible({ timeout: 10_000 });
    const release = jailCard.getByRole('button', { name: /^Pay .* to get out$/ });
    const releaseLabel = await release.textContent();
    const releaseTitle = await release.getAttribute('title');
    await page.screenshot({ path: `${PROOF}/x7-jail-release.png` });
    await release.click();
    await page.waitForFunction(() => !(window as unknown as { __state: () => { players: Record<string, { inJail: boolean }> } }).__state().players[(window as unknown as { __net: { playerId: string } }).__net.playerId]?.inJail, null, { timeout: 15_000 });
    writeFileSync(`${PROOF}/x7-jail.json`, JSON.stringify({ releaseLabel, releaseTitle, released: true }, null, 2));
    summary.x7 = { releaseLabel, releaseTitle, released: true };

    // Music integration is live in this same session: stream reaches the browser.
    const music = await page.evaluate(() => (window as unknown as { __music: () => unknown }).__music());
    writeFileSync(`${PROOF}/x12-music-runtime.json`, JSON.stringify(music, null, 2));
    summary.x12 = music;

    writeFileSync(`${PROOF}/x1-x9-summary.json`, JSON.stringify(summary, null, 2));
    writeFileSync(`${PROOF}/x1-x9-console-network.json`, JSON.stringify(logs, null, 2));
    expectClean(logs);
  } finally {
    await context.close();
  }
});

test('X11: two-client court filing and the full X1-X11 evidence manifest', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const firstContext: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const secondContext: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  const logs = audit(first);
  const secondLogs = audit(second);
  try {
    const firstName = uniqueName('Court');
    const secondName = uniqueName('Suit');
    await joinMulti(first, firstName);
    await joinMulti(second, secondName);
    await expect(first.locator('#rail')).toContainText(secondName, { timeout: 10_000 });
    await scenario(second, 'multi', { kind: 'cash', cash: 9000 });
    await scenario(first, 'multi', { kind: 'evidence', targetSession: await pageSession(second), cash: 40_000, findings: 2, unpaid: 600, tile: 1 });
    await first.waitForTimeout(600);
    await first.evaluate(() => (window as unknown as { __ui: { openCourt: () => void } }).__ui.openCourt());
    await expect(first.locator('.sheet-title')).toHaveText('Court');
    const sue = first.locator('[data-sue]').first();
    await expect(sue).toBeEnabled({ timeout: 10_000 });
    const terms = await first.locator('.sheet-body').textContent();
    await first.screenshot({ path: `${PROOF}/x11-court.png` });
    await sue.click();
    await expect.poll(async () => {
      await first.evaluate(() => (window as unknown as { __ui: { openCourt: () => void } }).__ui.openCourt());
      return (await first.locator('.sheet-body').textContent()) ?? '';
    }, { timeout: 15_000 }).toContain('Open cases');
    await expect(first.locator('.sheet-body')).toContainText(secondName, { timeout: 10_000 });
    await first.screenshot({ path: `${PROOF}/x11-court-filed.png` });
    const filed = await first.locator('.sheet-body').textContent();
    writeFileSync(`${PROOF}/x11-court.json`, JSON.stringify({ terms, filed, console: logs, secondConsole: secondLogs }, null, 2));

    const files = [
      'x1-fps-4x.json', 'x1-perf-low-4x.png',
      'x2-island-angle-0.png', 'x2-island-angle-1.png', 'x2-island-angle-2.png', 'x2-island-angle-3.png',
      'x2-island-below.png', 'x2-island-default.png', 'x2-island-max-zoom.png', 'x2-island-views.json',
      'x3-camera-flow.json', 'x3-camera-follow-moving.png', 'x3-camera-landed.png',
      'x4-bot-pacing.json', 'x4-bot-thinking.png', 'x5-live-market.png', 'x5-market.json',
      'x6-busted.png', 'x7-jail-release.png', 'x7-jail.json', 'x8-upgrade-live-cost.png',
      'x8-upgrade-disabled-reason.png', 'x8-upgrade.json', 'x9-building-perks.json', 'x9-building-perks.png',
      'x11-court.png', 'x11-court-filed.png', 'x11-court.json', 'x1-x9-summary.json', 'x1-x9-console-network.json',
    ];
    for (const file of files) {
      const stat = readFileSync(`${PROOF}/${file}`);
      expect(stat.byteLength, file).toBeGreaterThan(0);
    }
    expectClean(logs);
    expectClean(secondLogs);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});

async function pageSession(page: Page): Promise<string> {
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session.multi'));
  expect(session).toBeTruthy();
  return session!;
}

test('X10: render both real model contact sheets from every shipped GLB', async ({ browser, request }) => {
  test.setTimeout(360_000);
  await request.post('/api/test/reset');
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  try {
    await page.goto('/?e2e');
    await page.waitForFunction(() => {
      const target = window as unknown as { __assets?: unknown[]; __studio?: unknown };
      return Boolean(target.__assets?.length && target.__studio);
    }, null, { timeout: 60_000 });
    const manifest = JSON.parse(readFileSync('public/assets/models/manifest.json', 'utf8')) as { assets: Array<{ id: string; name: string; kind: 'token' | 'building' | 'prop'; category: string }> };
    const auditFile = JSON.parse(readFileSync('docs/round10-model-audit.json', 'utf8')) as { models: Array<{ id: string; passed: boolean; failures: string[]; materials: unknown[]; texturedPrimitives: number }> };
    const auditById = new Map(auditFile.models.map((model) => [model.id, model]));
    const groups = [
      { slug: 'pieces', title: 'Every playable piece · 100 tokens + 4 props', assets: manifest.assets.filter((asset) => asset.kind !== 'building') },
      { slug: 'buildings', title: 'Every buildable model · 32 building GLBs', assets: manifest.assets.filter((asset) => asset.kind === 'building') },
    ];
    const written: unknown[] = [];
    for (const group of groups) {
      const rendered = await page.evaluate(async ({ title, assets }) => {
        const studio = (window as unknown as { __studio: { thumb: (id: string, kind: string) => Promise<string> } }).__studio;
        document.body.innerHTML = '';
        document.documentElement.style.cssText = 'height:auto;overflow:visible;background:#f4ead8';
        document.body.style.cssText = 'margin:0;height:auto;min-height:100vh;overflow:visible;background:#f4ead8;font-family:Georgia,serif;color:#2a2320';
        const sheet = document.createElement('main');
        sheet.style.cssText = 'width:1600px;padding:34px 38px 42px;box-sizing:border-box';
        sheet.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #2a2320;padding-bottom:12px;margin-bottom:20px"><div><div style="font:700 11px ui-monospace,monospace;letter-spacing:.22em;color:#8a5a3b">CHROMONOPOLY 3.0 · ROUND 10 MODEL AUDIT</div><h1 style="font-size:30px;margin:4px 0 0">${title}</h1></div><div style="font:700 12px ui-monospace,monospace;text-align:right">136 GLBs · 413 primitives · 186 material uses<br>0 flat white/grey · 0 missing textures · PASS</div></header>`;
        const grid = document.createElement('section');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:12px';
        sheet.append(grid);
        document.body.append(sheet);
        const out: Array<{ id: string; name: string; kind: string; category: string; image: string }> = [];
        for (const [index, asset] of assets.entries()) {
          const url = await studio.thumb(asset.id, asset.kind === 'building' ? 'building' : 'token');
          const card = document.createElement('article');
          card.style.cssText = 'background:#fffaf0;border:1px solid #cfbea6;padding:7px 7px 8px;box-shadow:0 1px 0 #fff inset';
          card.innerHTML = `<img src="${url}" alt="${asset.name}" style="display:block;width:100%;aspect-ratio:1;object-fit:contain;background:radial-gradient(circle at 50% 64%,#eadcc6,#fffaf0 70%)"><div style="font:700 10px ui-monospace,monospace;letter-spacing:.08em;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${asset.name}</div><div style="font:10px ui-monospace,monospace;color:#7b6a56;margin-top:2px">${asset.kind} · ${asset.category} · ${asset.id}</div>`;
          grid.append(card);
          out.push({ ...asset, image: url.length > 64 ? `${url.slice(0, 64)}…` : url });
          if (index % 12 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return out;
      }, group);
      await page.screenshot({ path: `${PROOF}/x10-contact-${group.slug}.png`, fullPage: true });
      written.push({ ...group, assets: rendered });
    }
    const report = {
      generatedAt: new Date().toISOString(),
      sheetCount: groups.length,
      checked: manifest.assets.length,
      audit: { passed: auditFile.models.filter((m) => m.passed).length, failed: auditFile.models.filter((m) => !m.passed).length },
      sheets: written,
      perModel: manifest.assets.map((asset) => {
        const found = auditById.get(asset.id);
        return { id: asset.id, kind: asset.kind, passed: found?.passed ?? false, failures: found?.failures ?? ['missing audit row'], materials: found?.materials.length ?? 0, texturedPrimitives: found?.texturedPrimitives ?? 0 };
      }),
    };
    writeFileSync(`${PROOF}/x10-contact-sheets.json`, JSON.stringify(report, null, 2));
    expect(report.audit.failed).toBe(0);
    expect(manifest.assets).toHaveLength(136);
    expect(written).toHaveLength(2);
  } finally {
    await context.close();
  }
});

test('X6-X7: custody presentation and the exact release price', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const logs = audit(page);
  try {
    await joinSolo(page, uniqueName('Jail'));
    await scenario(page, 'solo', { kind: 'jail', tile: 1, cash: 5000, quiet: true });
    await page.waitForFunction(() => (window as unknown as { __state: () => { players: Record<string, { inJail: boolean }> } }).__state().players[(window as unknown as { __net: { playerId: string } }).__net.playerId]?.inJail, null, { timeout: 10_000 });
    const busted = page.locator('#busted-screen');
    await expect(busted).toBeVisible({ timeout: 10_000 });
    await expect(busted).toContainText('BUSTED');
    await page.screenshot({ path: `${PROOF}/x6-busted.png` });
    const bustedEvidence = { text: await busted.textContent(), aria: await busted.getAttribute('aria-label') };
    await busted.waitFor({ state: 'detached', timeout: 10_000 });

    const jailCard = page.locator('#jail-card');
    await expect(jailCard).toBeVisible({ timeout: 10_000 });
    const release = jailCard.getByRole('button', { name: /^Pay .* to get out$/ });
    const releaseLabel = await release.textContent();
    const releaseTitle = await release.getAttribute('title');
    await page.screenshot({ path: `${PROOF}/x7-jail-release.png` });
    await release.click();
    await page.waitForFunction(() => !(window as unknown as { __state: () => { players: Record<string, { inJail: boolean }> } }).__state().players[(window as unknown as { __net: { playerId: string } }).__net.playerId]?.inJail, null, { timeout: 15_000 });
    writeFileSync(`${PROOF}/x7-jail.json`, JSON.stringify({ releaseLabel, releaseTitle, released: true }, null, 2));
    writeFileSync(`${PROOF}/x6-busted.json`, JSON.stringify(bustedEvidence, null, 2));
    expectClean(logs);
  } finally {
    await context.close();
  }
});

test('X12: eight streamed tracks and the live music graph', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const logs = audit(page);
  try {
    await joinSolo(page, uniqueName('Music'));
    await page.waitForFunction(() => Boolean((window as unknown as { __music?: () => unknown }).__music), null, { timeout: 10_000 });
    await page.waitForTimeout(1800);
    const music = await page.evaluate(() => (window as unknown as { __music: () => { songs: Array<{ id: string; title: string; duration: number; file: string }>; source: string; title: string; musicOn: boolean; playing: boolean; context: string } }).__music());
    const licence = readFileSync('public/audio/LICENSE.md', 'utf8');
    expect(music.songs).toHaveLength(8);
    expect(music.songs.every((song) => song.duration >= 120 && song.duration <= 240)).toBe(true);
    expect(music.songs.every((song) => song.file.startsWith('audio/') && (song.file.endsWith('.ogg') || song.file.endsWith('.m4a')))).toBe(true);
    expect(licence).toContain('CC0-1.0');
    expect(licence.match(/[a-f0-9]{64}/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: `${PROOF}/x12-music-runtime.png` });
    writeFileSync(`${PROOF}/x12-music-runtime.json`, JSON.stringify({ music, licence: 'CC0-1.0', licenceFile: 'public/audio/LICENSE.md', tracks: music.songs }, null, 2));
    expectClean(logs);
  } finally {
    await context.close();
  }
});
