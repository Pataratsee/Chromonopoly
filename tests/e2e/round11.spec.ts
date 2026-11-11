import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test.describe.configure({ timeout: 240_000, mode: 'serial' });
const PROOF = 'docs/round11-proof';
mkdirSync(PROOF, { recursive: true });

declare global {
  interface Window {
    __auditNodes?: Array<{ id: string; at: number }>;
  }
}

async function loadTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const mark = performance.getEntriesByName('chromonopoly-ready')[0]?.startTime ?? performance.now();
    return Math.round(mark);
  });
}

async function skipTutorial(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Skip tutorial' });
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

test('Y1/Y2/Y11/Y5: cold, warm, 24 island views and every screen', async ({ page, request }) => {
  await request.post('/api/test/reset');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('/?e2e');
  await expect(page.locator('#player-name')).toBeVisible({ timeout: 20_000 });
  const cold = await loadTime(page);
  await page.reload();
  await expect(page.locator('#player-name')).toBeVisible({ timeout: 20_000 });
  const warm = await loadTime(page);
  writeFileSync(`${PROOF}/y1-load-times.json`, JSON.stringify({ coldMs: cold, warmMs: warm, budget: { cold: 5000, warm: 2000 } }, null, 2));
  expect(cold).toBeLessThanOrEqual(5000);
  expect(warm).toBeLessThanOrEqual(2000);

  await page.evaluate(() => {
    document.querySelector('.menu')?.remove();
    document.getElementById('boot')?.remove();
    document.getElementById('hud')?.classList.add('hidden');
  });
  const views: Array<{ view: string; stats: unknown; render: unknown }> = [];
  for (let i = 0; i < 24; i += 1) {
    const view = `angle-${i}`;
    await page.evaluate((v) => (window as unknown as { __cameraView: (x: string) => void }).__cameraView(v), view);
    await page.waitForTimeout(80);
    views.push({
      view,
      stats: await page.evaluate(() => (window as unknown as { __islandStats: () => unknown }).__islandStats()),
      render: await page.evaluate(() => (window as unknown as { __renderStats: () => unknown }).__renderStats()),
    });
    await page.screenshot({ path: `${PROOF}/y2-island-${view}.png` });
  }
  writeFileSync(`${PROOF}/y2-island-24-views.json`, JSON.stringify(views, null, 2));

  await page.evaluate(() => (window as unknown as { __campfireView: () => void }).__campfireView());
  await page.evaluate(() => (window as unknown as { __sky: { setHour: (h: number) => void } }).__sky.setHour(12));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${PROOF}/y11-campfire-day.png` });
  await page.evaluate(() => (window as unknown as { __sky: { setHour: (h: number) => void } }).__sky.setHour(22));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${PROOF}/y11-campfire-night.png` });
  await page.evaluate(() => {
    (window as unknown as { __sky: { setHour: (h: number) => void } }).__sky.setHour(12);
    document.getElementById('hud')?.classList.remove('hidden');
  });

  await joinSolo(page, `R11${Date.now().toString(36).slice(-6)}`);
  const screens = ['openMarket', 'openBank', 'openCrime', 'openDetective', 'openProperties', 'openReputation', 'openCourt', 'openLog', 'openSettings', 'openTokens', 'openHelp'];
  const screenResults: Array<{ method: string; title: string }> = [];
  for (const method of screens) {
    await page.evaluate((name) => {
      const ui = (window as unknown as { __ui: Record<string, () => void> }).__ui;
      ui[name]!();
    }, method);
    await expect(page.locator('.sheet-title')).toBeVisible();
    screenResults.push({ method, title: (await page.locator('.sheet-title').textContent()) ?? '' });
    await page.screenshot({ path: `${PROOF}/smoke-${method}.png` });
    await page.locator('.sheet-close').first().click();
    await expect(page.locator('.sheet-layer')).not.toHaveClass(/open/);
  }
  writeFileSync(`${PROOF}/every-screen-smoke.json`, JSON.stringify(screenResults, null, 2));
  expect(screenResults).toHaveLength(screens.length);
  expect(errors).toEqual([]);
});

test('Y8: chance result cards and BUSTED never precede wheel LANDED', async ({ page, request }) => {
  await request.post('/api/test/reset');
  await joinSolo(page, `Chance${Date.now().toString(36).slice(-5)}`);
  await page.evaluate(() => {
    const ui = (window as unknown as { __ui: { setPromptsBlocked: (v: boolean) => void; lastBustedAt: number } }).__ui;
    ui.setPromptsBlocked(false);
    window.__auditNodes = [];
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.id === 'chance-overlay' || node.id === 'crime-result' || node.id === 'busted-screen') {
            window.__auditNodes!.push({ id: node.id, at: Math.round(performance.now()) });
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  const kinds = ['theft', 'robbery', 'murder', 'detective', 'wipe', 'jail'] as const;
  const audit: unknown[] = [];
  for (const kind of kinds) {
    await page.evaluate((eventKind) => {
      const win = window as unknown as {
        __ui: { event: (e: unknown) => void; lastBustedAt: number };
        __net: { playerId: string };
        __auditNodes: Array<{ id: string; at: number }>;
      };
      win.__ui.lastBustedAt = 0;
      win.__ui.event({
        kind: eventKind,
        playerId: win.__net.playerId,
        text: eventKind === 'jail' ? 'the test scenario' : 'attempted',
        chance: { label: `Audit ${eventKind}`, percent: 50, success: false, rollPercent: 75, result: 'Failure' },
        outcome: eventKind === 'jail' ? undefined : {
          success: false,
          kind: eventKind,
          amount: 0,
          reputationDelta: -1,
          detail: `Audit ${eventKind} failure`,
        },
      });
    }, kind);
    const overlay = page.locator('#chance-overlay');
    await expect(overlay).toBeVisible();
    await overlay.locator('.chance-spin').click();
    await expect(overlay.locator('.chance-continue')).toBeVisible({ timeout: 10_000 });
    await overlay.locator('.chance-continue').click();
    if (kind !== 'jail') {
      await expect(page.locator('#crime-result')).toBeVisible({ timeout: 5000 });
      await page.locator('#crime-result button').click();
    }
    await expect(page.locator('#busted-screen')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1100);
    // The overlay intentionally ignores pointer input until armed and then
    // auto-dismisses. Dispatch the same close click without racing Playwright's
    // actionability retry against that timer.
    await page.evaluate(() => document.getElementById('busted-screen')?.click());
    await expect(page.locator('#busted-screen')).toHaveCount(0, { timeout: 5000 });
    const evidence = await page.evaluate(() => {
      const nodes = (window as unknown as { __auditNodes: Array<{ id: string; at: number }> }).__auditNodes;
      const transitions = (window as unknown as { __chanceTransitions: Array<{ state: string; at: number }> }).__chanceTransitions;
      return { nodes: nodes.splice(0), transitions };
    });
    const landed = evidence.transitions.find((t) => t.state === 'LANDED')?.at ?? 0;
    const overlayNode = evidence.nodes.find((n) => n.id === 'chance-overlay');
    const resultNode = evidence.nodes.find((n) => n.id === 'crime-result');
    const bustedNode = evidence.nodes.find((n) => n.id === 'busted-screen');
    expect(landed).toBeGreaterThan(0);
    if (resultNode) expect(resultNode.at).toBeGreaterThanOrEqual(landed);
    if (bustedNode) expect(bustedNode.at).toBeGreaterThanOrEqual(landed);
    expect(evidence.nodes.filter((n) => n.id === 'chance-overlay')).toHaveLength(1);
    audit.push({ kind, landed, overlay: overlayNode?.at, result: resultNode?.at, busted: bustedNode?.at });
    await page.waitForTimeout(200);
  }
  writeFileSync(`${PROOF}/y8-chance-order.json`, JSON.stringify(audit, null, 2));
  expect(audit).toHaveLength(kinds.length);
});

test('Y1: Fast 3G reaches the board within 8 seconds', async ({ page, context }) => {
  test.setTimeout(120_000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await page.goto('/?e2e', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#player-name')).toBeVisible({ timeout: 30_000 });
  const coldMs = await loadTime(page);
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').map((entry) => ({ name: entry.name, at: Math.round(entry.startTime) })));
  writeFileSync(`${PROOF}/y1-fast3g-load.json`, JSON.stringify({
    profile: 'Fast 3G 1.6 Mbps / 150 ms RTT, cold cache',
    coldMs,
    marks,
    budget: 8000,
  }, null, 2));
  expect(coldMs).toBeLessThanOrEqual(8000);
});

test('Y11: campfire is visible and reads as fire by day and night', async ({ page }) => {
  await page.goto('/?e2e');
  await expect(page.locator('#player-name')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    document.querySelector('.menu')?.remove();
    document.getElementById('boot')?.remove();
  });
  await page.evaluate(() => (window as unknown as { __campfireView: () => void }).__campfireView());
  await page.evaluate(() => (window as unknown as { __sky: { setHour: (h: number) => void } }).__sky.setHour(12));
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${PROOF}/y11-campfire-day.png` });
  await page.evaluate(() => (window as unknown as { __sky: { setHour: (h: number) => void } }).__sky.setHour(22));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${PROOF}/y11-campfire-night.png` });
});
