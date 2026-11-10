import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test.describe.configure({ timeout: 240_000, mode: 'serial' });

const PROOF = 'docs/round9-proof';
const contexts: BrowserContext[] = [];

interface Audit {
  console: string[];
  page: string[];
  failed: string[];
  badStatus: string[];
}

function audit(page: Page): Audit {
  const result: Audit = { console: [], page: [], failed: [], badStatus: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') result.console.push(message.text());
  });
  page.on('pageerror', (error) => result.page.push(error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (request.url().includes('favicon') || failure.includes('ERR_ABORTED')) return;
    result.failed.push(`${request.method()} ${request.url()} ${failure}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('favicon')) {
      result.badStatus.push(`${response.status()} ${response.url()}`);
    }
  });
  return result;
}

function expectClean(logs: Audit): void {
  expect(logs.console, `console errors:\n${logs.console.join('\n')}`).toEqual([]);
  expect(logs.page, `page errors:\n${logs.page.join('\n')}`).toEqual([]);
  expect(logs.failed, `failed requests:\n${logs.failed.join('\n')}`).toEqual([]);
  expect(logs.badStatus, `bad HTTP statuses:\n${logs.badStatus.join('\n')}`).toEqual([]);
}

async function context(browser: Browser, viewport = { width: 1280, height: 720 }): Promise<BrowserContext> {
  const created = await browser.newContext({ viewport });
  contexts.push(created);
  return created;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 16);
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
}

async function joinMulti(page: Page, name: string): Promise<void> {
  await page.goto('/?e2e');
  await expect(page.locator('#player-name')).toBeVisible();
  await page.locator('#player-name').fill(name);
  await page.locator('#multi-btn').click();
}

async function scenario(page: Page, mode: 'solo' | 'multi', setup: Record<string, unknown>): Promise<void> {
  const session = await page.evaluate((m) => localStorage.getItem(`chromonopoly.session.${m}`), mode);
  expect(session).toBeTruthy();
  const result = await page.evaluate(
    async ({ sessionKey, bodyMode, bodySetup }) => {
      const response = await fetch('/api/test/scenario', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session: sessionKey, mode: bodyMode, setup: bodySetup }),
      });
      return { status: response.status, body: await response.json() };
    },
    { sessionKey: session, bodyMode: mode, bodySetup: setup },
  );
  expect(result.status, JSON.stringify(result.body)).toBe(200);
}

async function closeSheet(page: Page): Promise<void> {
  const close = page.locator('.sheet-close').first();
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.locator('.sheet-layer')).not.toHaveClass(/open/);
}

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((item) => item.close().catch(() => undefined)));
});

test('W2: four frosted preview labels never overlap at five viewport/theme combinations', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const page = await context(browser).then((ctx) => ctx.newPage());
  const logs = audit(page);
  await page.goto('/?e2e');
  await expect(page.locator('.menu')).toBeVisible();
  await expect(page.locator('.preview-corner')).toHaveCount(4);
  await expect(page.locator('#menu-preview-loading')).toHaveCount(0, { timeout: 15_000 }).catch(() => undefined);

  const sizes = [
    { width: 1280, height: 720, label: '1280x720' },
    { width: 1920, height: 1080, label: '1920x1080' },
    { width: 2560, height: 1440, label: '2560x1440' },
    { width: 760, height: 900, label: 'narrow-760' },
    { width: 1280, height: 720, label: 'dark-1280x720' },
  ];
  for (const [index, size] of sizes.entries()) {
    await page.setViewportSize({ width: size.width, height: size.height });
    if (size.label.startsWith('dark')) await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      const preview = document.querySelector('.preview-corner')?.parentElement?.getBoundingClientRect();
      return [...document.querySelectorAll('.preview-corner')].map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent ?? '', x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, preview: preview ? { x: preview.x, y: preview.y, right: preview.right, bottom: preview.bottom } : null };
      });
    });
    expect(geometry).toHaveLength(4);
    for (const box of geometry) {
      expect(box.width).toBeGreaterThan(80);
      expect(box.height).toBeGreaterThanOrEqual(32);
      expect(box.x).toBeGreaterThanOrEqual((box.preview?.x ?? 0) - 0.5);
      expect(box.y).toBeGreaterThanOrEqual((box.preview?.y ?? 0) - 0.5);
      expect(box.right).toBeLessThanOrEqual((box.preview?.right ?? 0) + 0.5);
      expect(box.bottom).toBeLessThanOrEqual((box.preview?.bottom ?? 0) + 0.5);
    }
    for (let a = 0; a < geometry.length; a += 1) {
      for (let b = a + 1; b < geometry.length; b += 1) {
        const left = geometry[a]!;
        const right = geometry[b]!;
        const overlap = Math.min(left.right, right.right) - Math.max(left.x, right.x) > 0 && Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y) > 0;
        expect(overlap, `${left.text} overlaps ${right.text} at ${size.label}`).toBe(false);
      }
    }
    await page.screenshot({ path: `${PROOF}/w2-menu-${index}-${size.label}.png` });
    if (size.width <= 760) {
      await page.locator('.menu-right').screenshot({ path: `${PROOF}/w2-menu-${index}-${size.label}-preview.png` });
    }
  }
  expectClean(logs);
});

test('W1: username validation, seat reconnect and second-browser reclaim', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const firstContext = await context(browser);
  const first = await firstContext.newPage();
  const logs = audit(first);
  const name = uniqueName('Kitsune');

  await joinMulti(first, name);
  await expect(first.locator('#you-name')).toHaveText(name);
  await scenario(first, 'multi', { kind: 'cash', cash: 2345 });
  await expect(first.locator('#you-cash')).toContainText('2,345', { timeout: 10_000 });
  await first.screenshot({ path: `${PROOF}/w1-username-seat.png` });

  const secondContext = await context(browser);
  const second = await secondContext.newPage();
  const secondLogs = audit(second);
  await joinMulti(second, name);
  await expect(second.locator('.auth-error')).toContainText(/already taken/i);
  await expect(second.locator('.toast', { hasText: /already taken/i }).first()).toBeVisible();
  await second.screenshot({ path: `${PROOF}/w1-duplicate-name-toast.png` });

  await first.evaluate(() => {
    (window as unknown as { __net: { ws: WebSocket | null } }).__net.ws?.close();
  });
  await expect(first.locator('#net-dot')).toHaveClass(/off/);
  await expect(first.locator('#net-dot')).not.toHaveClass(/off/, { timeout: 15_000 });
  await expect(first.locator('#you-name')).toHaveText(name);
  await expect(first.locator('#you-cash')).toContainText('2,345');
  await first.screenshot({ path: `${PROOF}/w1-reconnect-same-seat.png` });

  const reclaimToken = await first.evaluate((key) => localStorage.getItem(`chromonopoly.player-token.${key.toLowerCase()}`), name);
  expect(reclaimToken).toBeTruthy();
  await firstContext.close();
  await second.evaluate(({ token, key }) => {
    localStorage.setItem(`chromonopoly.player-token.${key.toLowerCase()}`, token!);
  }, { token: reclaimToken, key: name });
  await second.reload();
  await expect(second.locator('#player-name')).toHaveValue(name);
  await second.locator('#multi-btn').click();
  await expect(second.locator('#you-name')).toHaveText(name, { timeout: 15_000 });
  await expect(second.locator('#you-cash')).toContainText('2,345', { timeout: 10_000 });
  await second.screenshot({ path: `${PROOF}/w1-second-browser-reclaim.png` });
  expectClean(logs);
  expectClean(secondLogs);
});

test('W3/W6: cash chip in every spending panel and one global error toast above them', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const page = await context(browser).then((ctx) => ctx.newPage());
  const logs = audit(page);
  const name = uniqueName('Ledger');
  await joinSolo(page, name);
  await scenario(page, 'solo', { kind: 'build', tile: 1, cash: 9000 });
  await expect(page.locator('#you-cash')).toContainText('9,000', { timeout: 10_000 });

  await page.locator('[data-dock="Bank"]').click();
  await expect(page.locator('#bank-outstanding')).toHaveText('$0');
  await expect(page.locator('.sheet .sheet-cash')).toContainText('9,000');
  await page.getByRole('button', { name: 'Borrow', exact: true }).click();
  await expect(page.locator('#bank-outstanding')).not.toHaveText('$0', { timeout: 10_000 });
  await closeSheet(page);
  await page.locator('[data-dock="Bank"]').click();
  await expect(page.locator('.sheet .note.warn')).toContainText(/Repay your outstanding loan/i);
  await expect(page.getByRole('button', { name: 'Borrow', exact: true })).toBeDisabled();
  await page.evaluate(() => {
    (window as unknown as { __net: { send: (intent: unknown) => void } }).__net.send({ t: 'loan', amount: 200, key: `repeat-${Date.now()}` });
  });
  await expect(page.locator('.toast', { hasText: /loan|Repay/i })).toBeVisible({ timeout: 10_000 });
  const toastZ = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.toast-layer')!).zIndex));
  const sheetZ = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.sheet-layer')!).zIndex));
  expect(toastZ).toBeGreaterThan(sheetZ);
  await page.screenshot({ path: `${PROOF}/w6-bank-cash-and-toast.png` });
  await closeSheet(page);

  await page.locator('[data-dock="Market"]').click();
  await expect(page.locator('.sheet .sheet-cash')).toContainText('9,200');
  await page.screenshot({ path: `${PROOF}/w6-market-cash.png` });
  await closeSheet(page);

  await page.locator('[data-dock="Properties"]').click();
  await expect(page.locator('.sheet .sheet-cash')).toContainText('9,200');
  await page.getByRole('button', { name: 'Build here' }).first().click();
  await expect(page.locator('.sheet-title')).toContainText('Build on');
  await expect(page.locator('.sheet .sheet-cash')).toContainText('9,200');
  await page.screenshot({ path: `${PROOF}/w6-build-cash.png` });
  await closeSheet(page);

  await scenario(page, 'solo', { kind: 'rent', tile: 1, cash: 800 });
  await expect(page.locator('#pending-overlay')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#pending-overlay .sheet-cash')).toContainText(/800|\$0/);
  await page.screenshot({ path: `${PROOF}/w6-pending-cash.png` });
  expectClean(logs);
});

test('W5: wheel IDLE→CLOSED with 100 ms samples and no result before LANDED', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const page = await context(browser).then((ctx) => ctx.newPage());
  const logs = audit(page);
  const name = uniqueName('Wheel');
  await joinMulti(page, name);
  await expect(page.locator('#you-name')).toHaveText(name);
  await scenario(page, 'multi', { kind: 'cash', cash: 500_000, reputation: 60 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    (window as unknown as { __net: { send: (intent: unknown) => void } }).__net.send({ t: 'recordWipe', key: `wipe-${Date.now()}` });
  });
  const overlay = page.locator('#chance-overlay');
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  await expect(overlay).toHaveAttribute('data-state', 'READY');
  await page.evaluate(() => {
    const samples: Array<{ at: number; state: string; text: string; revealed: boolean; styled: boolean }> = [];
    (window as unknown as { __wheelSamples: typeof samples }).__wheelSamples = samples;
    (window as unknown as { __wheelSampler: number }).__wheelSampler = window.setInterval(() => {
      const box = document.getElementById('chance-overlay');
      const result = box?.querySelector('.chance-result');
      const proceed = box?.querySelector('.chance-continue');
      if (!box || !result || !proceed) return;
      samples.push({
        at: Math.round(performance.now()),
        state: box.dataset.state ?? '',
        text: result.textContent ?? '',
        revealed: !proceed.classList.contains('hidden'),
        styled: result.classList.contains('good') || result.classList.contains('bad'),
      });
    }, 100);
  });
  await overlay.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(overlay).toHaveAttribute('data-state', 'LANDED', { timeout: 12_000 });
  await page.screenshot({ path: `${PROOF}/w5-wheel-landed-before-result.png` });
  await expect(overlay).toHaveAttribute('data-state', 'RESULT_SHOWN', { timeout: 3000 });
  await page.screenshot({ path: `${PROOF}/w5-wheel-result-after-stop.png` });
  const evidence = await page.evaluate(() => {
    clearInterval((window as unknown as { __wheelSampler: number }).__wheelSampler);
    const wheel = (window as unknown as { __chanceWheel: { transitions: Array<{ state: string; at: number }> } }).__chanceWheel;
    return {
      samples: (window as unknown as { __wheelSamples: Array<{ at: number; state: string; text: string; revealed: boolean; styled: boolean }> }).__wheelSamples,
      transitions: wheel.transitions,
    };
  });
  writeFileSync(`${PROOF}/w5-wheel-100ms.json`, JSON.stringify(evidence, null, 2));
  const states = evidence.transitions.map((entry) => entry.state);
  expect(states.slice(0, 5)).toEqual(['IDLE', 'READY', 'SPINNING', 'LANDED', 'RESULT_SHOWN']);
  for (let i = 1; i < evidence.transitions.length; i += 1) {
    expect(evidence.transitions[i]!.at).toBeGreaterThanOrEqual(evidence.transitions[i - 1]!.at);
  }
  const landedAt = evidence.transitions.find((entry) => entry.state === 'LANDED')!.at;
  const shownAt = evidence.transitions.find((entry) => entry.state === 'RESULT_SHOWN')!.at;
  expect(shownAt - landedAt).toBeGreaterThanOrEqual(250);
  const landedSamples = evidence.samples.filter((sample) => sample.state === 'LANDED');
  expect(landedSamples.length).toBeGreaterThan(0);
  for (const sample of evidence.samples.filter((item) => item.state === 'SPINNING' || item.state === 'LANDED')) {
    expect(sample.revealed).toBe(false);
    expect(sample.styled).toBe(false);
    expect(sample.text).toBe('Spin to reveal');
  }
  const shown = evidence.samples.filter((sample) => sample.state === 'RESULT_SHOWN');
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.every((sample) => sample.revealed && sample.styled && sample.text !== 'Spin to reveal')).toBe(true);
  await overlay.locator('.chance-continue').click();
  await expect(overlay).toHaveCount(0);
  expectClean(logs);
});

test('W4: four island angles, triangle audit and render stats', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const page = await context(browser).then((ctx) => ctx.newPage());
  const logs = audit(page);
  await joinSolo(page, uniqueName('Island'));
  await page.waitForTimeout(800);
  const auditStats = await page.evaluate(() => {
    const api = (window as unknown as { __islandStats: () => { triangles: number; details: number; petals: number } }).__islandStats;
    return api();
  });
  expect(auditStats.triangles).toBeGreaterThan(1000);
  expect(auditStats.triangles).toBeLessThan(40_000);
  await page.evaluate(() => {
    document.getElementById('hud')?.classList.add('hidden');
    document.querySelectorAll('.sheet-layer.open').forEach((element) => element.classList.remove('open'));
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${PROOF}/w4-island-default.png` });
  await page.evaluate(() => {
    const stage = (window as unknown as {
      __stage: {
        rig: {
          manualUntil: number; radius: number; wantRadius: number; pitch: number; wantPitch: number;
          target: { set: (x: number, y: number, z: number) => void };
          wantTarget: { set: (x: number, y: number, z: number) => void };
          update: (dt: number) => void;
        };
        render: () => void;
      };
    }).__stage;
    stage.rig.manualUntil = performance.now() + 60_000;
    stage.rig.radius = 13.5;
    stage.rig.wantRadius = 13.5;
    stage.rig.pitch = 0.55;
    stage.rig.wantPitch = 0.55;
    stage.rig.target.set(0, -2.2, 0);
    stage.rig.wantTarget.set(0, -2.2, 0);
    stage.rig.update(1);
    stage.render();
  });
  await page.screenshot({ path: `${PROOF}/w4-island-closest.png` });
  const views = [];
  for (let angle = 0; angle < 4; angle += 1) {
    const stats = await page.evaluate((index: number) => (window as unknown as { __islandProof: (i: number) => unknown }).__islandProof(index), angle);
    await page.waitForTimeout(300);
    const render = await page.evaluate(() => (window as unknown as { __renderStats: () => unknown }).__renderStats());
    views.push({ angle, stats, render });
    await page.screenshot({ path: `${PROOF}/w4-island-angle-${angle}.png` });
  }
  writeFileSync(`${PROOF}/w4-island-triangles.json`, JSON.stringify({ audit: auditStats, views }, null, 2));
  expectClean(logs);
});

test('W13: rival dice, tile follow, landing pause, zoom-out and turn pass', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const page = await context(browser).then((ctx) => ctx.newPage());
  const logs = audit(page);
  await page.addInitScript(() => localStorage.setItem('chromonopoly.settings', JSON.stringify({ fastBots: false })));
  await joinSolo(page, uniqueName('Bots'));

  const botRolls = () => page.evaluate(() =>
    ((window as unknown as { __botLog?: Array<{ event: string }> }).__botLog ?? []).filter((entry) => entry.event === 'roll').length,
  );
  const promptLoop = Date.now() + 60_000;
  while (Date.now() < promptLoop && await botRolls() === 0) {
    const chance = page.locator('#chance-overlay');
    if (await chance.isVisible().catch(() => false)) {
      const spin = chance.getByRole('button', { name: 'Spin', exact: true });
      if (await spin.isVisible().catch(() => false)) await spin.click().catch(() => undefined);
      await page.waitForTimeout(6500);
      const proceed = chance.locator('.chance-continue');
      if (await proceed.isVisible().catch(() => false)) await proceed.click().catch(() => undefined);
    }
    const crime = page.locator('#crime-result button', { hasText: 'Continue' });
    if (await crime.isVisible().catch(() => false)) await crime.click().catch(() => undefined);
    const decline = page.getByRole('button', { name: 'Decline', exact: true });
    if (await decline.isVisible().catch(() => false)) await decline.click().catch(() => undefined);
    const pay = page.getByRole('button', { name: /^Pay / });
    if (await pay.isVisible().catch(() => false)) await pay.click().catch(() => undefined);
    const roll = page.locator('#roll-btn');
    const label = (await roll.textContent().catch(() => ''))?.trim();
    if (label === 'ROLL' && await roll.isEnabled().catch(() => false)) await roll.click().catch(() => undefined);
    await page.waitForTimeout(500);
  }
  expect(await botRolls()).toBeGreaterThan(0);
  await page.waitForFunction(
    () => {
      const log = (window as unknown as { __botLog?: Array<{ event: string }> }).__botLog ?? [];
      return log.some((entry) => ['purchase', 'rent', 'card'].includes(entry.event)) || log.filter((entry) => entry.event === 'zoom-out').length >= 3;
    },
    null,
    { timeout: 90_000 },
  );
  const evidence = await page.evaluate(() => ({
    log: (window as unknown as { __botLog?: Array<{ at: number; player?: string; event: string; detail?: string | number }> }).__botLog ?? [],
    ribbon: document.getElementById('ribbon')?.textContent ?? '',
    ribbonSub: document.getElementById('ribbon-sub')?.textContent ?? '',
  }));
  writeFileSync(`${PROOF}/w13-bot-log.json`, JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: `${PROOF}/w13-bot-turn.png` });

  const events = evidence.log.map((entry) => entry.event);
  const roll = events.indexOf('roll');
  const follow = events.indexOf('follow');
  const landed = events.indexOf('landed');
  const pause = events.indexOf('pause');
  const zoom = events.indexOf('zoom-out');
  expect(roll).toBeGreaterThanOrEqual(0);
  expect(follow).toBeGreaterThan(roll);
  expect(landed).toBeGreaterThan(follow);
  expect(pause).toBeGreaterThan(landed);
  expect(zoom).toBeGreaterThan(pause);
  const followAt = evidence.log[follow]!.at;
  const landedAt = evidence.log[landed]!.at;
  const pauseAt = evidence.log[pause]!.at;
  const zoomAt = evidence.log[zoom]!.at;
  expect(landedAt - followAt).toBeGreaterThan(150);
  expect(pauseAt - landedAt).toBeGreaterThanOrEqual(850);
  expect(zoomAt - pauseAt).toBeGreaterThan(150);
  expect(Number(evidence.log[pause]!.detail)).toBeGreaterThanOrEqual(850);
  const action = evidence.log.find((entry) => ['purchase', 'rent', 'card'].includes(entry.event));
  expect(action, JSON.stringify(evidence.log)).toBeTruthy();
  const rollDetail = String(evidence.log[roll]!.detail ?? '');
  expect(rollDetail).toMatch(/^\d\+\d+=\d+$/);
  expect(evidence.log[roll]!.player).toBeTruthy();
  expect(evidence.ribbon.length).toBeGreaterThan(0);
  expectClean(logs);
});

test('W7: live drag, wheel zoom and resize keep the pivot inside its radius', async ({ browser, request }) => {
  await request.post('/api/test/reset');
  const page = await context(browser).then((ctx) => ctx.newPage());
  const logs = audit(page);
  await joinSolo(page, uniqueName('Camera'));
  await page.waitForTimeout(700);
  const before = await page.evaluate(() => {
    const rig = (window as unknown as { __stage: { rig: { radius: number; target: { x: number; z: number } } } }).__stage.rig;
    return { radius: rig.radius, pivot: Math.hypot(rig.target.x, rig.target.z) };
  });
  const box = await page.locator('#scene').boundingBox();
  expect(box).toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 35, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -520);
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => {
    const rig = (window as unknown as { __stage: { rig: { radius: number; target: { x: number; z: number }; yaw: number } } }).__stage.rig;
    return { radius: rig.radius, pivot: Math.hypot(rig.target.x, rig.target.z), yaw: rig.yaw };
  });
  expect(after.radius).toBeLessThan(before.radius);
  expect(after.pivot).toBeLessThanOrEqual(1.25 + 1e-6);
  expect(Number.isFinite(after.yaw)).toBe(true);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(200);
  const aspect = await page.evaluate(() => (window as unknown as { __stage: { camera: { aspect: number } } }).__stage.camera.aspect);
  expect(aspect).toBeCloseTo(900 / 600, 3);
  await page.screenshot({ path: `${PROOF}/w7-camera-resize.png` });
  expectClean(logs);
});

test('W9/W10/W11/W12: rent example, transfer warning, wipe wheel and live market', async ({ browser, request }) => {
  // Two live clients, two chance wheels and a dozen animated sheets push this
  // past the suite-wide 240 s budget while still passing every assertion.
  test.setTimeout(420_000);
  await request.post('/api/test/reset');
  const firstContext = await context(browser);
  const page = await firstContext.newPage();
  const logs = audit(page);
  const firstName = uniqueName('Ledger');
  await joinMulti(page, firstName);
  await expect(page.locator('#you-name')).toHaveText(firstName);
  await scenario(page, 'multi', { kind: 'build', tile: 1, cash: 20_000 });
  await page.evaluate(() => {
    (window as unknown as { __net: { send: (intent: unknown) => void } }).__net.send({ t: 'build', tile: 1, type: 'house', key: `build-${Date.now()}` });
  });
  await page.waitForFunction(() => {
    const state = (window as unknown as { __state: () => { tiles: Record<number, { buildings: unknown[] }> } }).__state();
    return state.tiles[1]?.buildings.length === 1;
  }, null, { timeout: 10_000 });
  await page.locator('[data-dock="Properties"]').click();
  const example = page.locator('[data-rent-example]').first();
  await expect(example).toBeVisible();
  await expect(example).toContainText(/highest rank 1|no buildings/);
  await expect(example).toContainText(/At your \$/);
  await expect(example).toContainText(/cash this deed asks/);
  await page.screenshot({ path: `${PROOF}/w9-rent-example.png` });
  await closeSheet(page);

  await page.locator('[data-dock="Market"]').click();
  await expect(page.locator('.market-row')).toHaveCount(28);
  await expect(page.locator('[data-sum="net"]')).toBeVisible();
  const beforePrice = await page.evaluate(() => (window as unknown as { __state: () => { prices: Record<number, number> } }).__state().prices[1]);
  await page.waitForFunction((oldPrice) => (window as unknown as { __state: () => { prices: Record<number, number> } }).__state().prices[1] !== oldPrice, beforePrice, { timeout: 12_000 });
  const afterPrice = await page.evaluate(() => (window as unknown as { __state: () => { prices: Record<number, number> } }).__state().prices[1]);
  expect(afterPrice).not.toBe(beforePrice);
  await page.screenshot({ path: `${PROOF}/w12-live-market.png` });
  await closeSheet(page);

  const secondContext = await context(browser);
  const second = await secondContext.newPage();
  const secondLogs = audit(second);
  const secondName = uniqueName('Target');
  await joinMulti(second, secondName);
  await expect(second.locator('#you-name')).toHaveText(secondName);
  await expect(page.locator('#rail')).toContainText(secondName, { timeout: 10_000 });
  await page.locator('[data-dock="Underworld"]').click();
  const targetRow = page.locator('.sheet .row').filter({ hasText: secondName });
  await expect(targetRow).toContainText(secondName);
  await targetRow.getByRole('button', { name: 'Murder', exact: true }).click();
  await expect(page.locator('.sheet-title')).toHaveText('Attempt murder: ' + secondName);
  await expect(page.locator('.sheet-body')).toContainText('every deed and building transfers to you');
  await expect(page.locator('.sheet-body')).toContainText('Hospital 3 turns · $0 cash');
  await page.screenshot({ path: `${PROOF}/w10-murder-transfer-warning.png` });
  await closeSheet(page);

  // Force the server roll to success so the browser proves the actual transfer,
  // not only the warning. The victim owns a separate colour group.
  await scenario(second, 'multi', { kind: 'build', tile: 6, cash: 9000 });
  await scenario(page, 'multi', { kind: 'cash', cash: 50_000, roll: 0.01 });
  await page.locator('[data-dock="Underworld"]').click();
  const transferRow = page.locator('.sheet .row').filter({ hasText: secondName });
  await transferRow.getByRole('button', { name: 'Murder', exact: true }).click();
  await page.getByRole('button', { name: 'I understand — attempt murder' }).click();
  // Murder resolves through the server's 5% chance wheel; the outcome card
  // must not appear until the wheel has stopped and been acknowledged.
  const murderWheel = page.locator('#chance-overlay');
  await expect(murderWheel).toBeVisible({ timeout: 10_000 });
  await expect(murderWheel).toHaveAttribute('data-chance', '5');
  await expect(murderWheel).toHaveAttribute('data-state', 'READY');
  await page.screenshot({ path: `${PROOF}/w10-murder-wheel.png` });
  await murderWheel.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(murderWheel).toHaveAttribute('data-state', 'LANDED', { timeout: 12_000 });
  await expect(murderWheel).toHaveAttribute('data-state', 'RESULT_SHOWN', { timeout: 3000 });
  await murderWheel.locator('.chance-continue').click();
  await expect(murderWheel).toHaveCount(0);
  const crimeResult = page.locator('#crime-result');
  await expect(crimeResult).toBeVisible({ timeout: 10_000 });
  await expect(crimeResult).toContainText('Success');
  await expect(crimeResult).toContainText('Properties transferred');
  await expect(crimeResult).toContainText(secondName);
  await page.screenshot({ path: `${PROOF}/w10-murder-transfer-result.png` });
  const transferredOwner = await page.evaluate(() => {
    const state = (window as unknown as { __state: () => { tiles: Record<number, { ownerId: string | null }>; players: Record<string, { name: string }> } }).__state();
    return state.players[state.tiles[6]!.ownerId!]?.name ?? '';
  });
  expect(transferredOwner).toBe(firstName);
  await crimeResult.getByRole('button', { name: 'Continue' }).click();
  await expect(crimeResult).toHaveCount(0);

  await page.locator('[data-dock="Reputation"]').click();
  await expect(page.locator('.sheet-body')).toContainText(`Murdered ${secondName}.`);
  await closeSheet(page);

  await scenario(page, 'multi', { kind: 'cash', cash: 500_000, roll: 0.01 });
  await expect(page.locator('#you-cash')).toContainText('500,000', { timeout: 10_000 });
  await page.locator('[data-dock="Reputation"]').click();
  await expect(page.locator('#wipe-record')).toBeEnabled();
  await expect(page.locator('.sheet-body')).toContainText('15% chance');
  await page.locator('#wipe-record').click();
  await expect(page.locator('.sheet-title')).toHaveText('Confirm record wipe');
  await expect(page.locator('.sheet-body')).toContainText('15%');
  await page.screenshot({ path: `${PROOF}/w11-wipe-confirm.png` });
  await page.getByRole('button', { name: 'Pay $500,000 and spin' }).click();
  const wheel = page.locator('#chance-overlay');
  await expect(wheel).toBeVisible({ timeout: 10_000 });
  await expect(wheel).toHaveAttribute('data-chance', '15');
  await wheel.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(wheel).toHaveAttribute('data-state', 'LANDED', { timeout: 12_000 });
  await expect(wheel).toHaveAttribute('data-state', 'RESULT_SHOWN', { timeout: 3000 });
  await page.screenshot({ path: `${PROOF}/w11-wipe-wheel.png` });
  await wheel.locator('.chance-continue').click();
  await expect(wheel).toHaveCount(0);
  const result = page.locator('#crime-result');
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toContainText('Success');
  await expect(result).toContainText('records are gone');
  await page.screenshot({ path: `${PROOF}/w11-wipe-success.png` });
  await result.getByRole('button', { name: 'Continue' }).click();
  await expect(result).toHaveCount(0);
  await page.locator('[data-dock="Reputation"]').click();
  await expect(page.locator('.sheet-body')).not.toContainText(`Murdered ${secondName}.`);
  await expect(page.locator('.sheet-body')).toContainText('No crimes or evasions recorded');
  await closeSheet(page);
  expectClean(logs);
  expectClean(secondLogs);
});
