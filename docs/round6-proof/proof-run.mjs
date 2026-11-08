import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8793';
const OUT = 'docs/round6-proof';
const phase = process.argv[2] ?? 'smoke';

await fetch(`${BASE}/api/test/reset`, { method: 'POST' });
const browser = await chromium.launch();

function watch(page, logs) {
  page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: String(e) }));
  page.on('requestfailed', (r) => logs.push({ type: 'requestfailed', text: `${r.url()} ${r.failure()?.errorText ?? ''}` }));
  page.on('response', (r) => {
    if (r.status() >= 400) logs.push({ type: 'http', text: `${r.status()} ${r.url()}` });
  });
}

async function join(ctx, name = 'Proof', mode = 'multi', params = '?e2e&visual=1') {
  const page = await ctx.newPage();
  const logs = [];
  watch(page, logs);
  await page.goto(`${BASE}/${params}`);
  try {
    await page.locator('#name-input').waitFor({ state: 'attached', timeout: 90000 });
  } catch (error) {
    console.log('JOIN FAILED', name, await page.locator('body').innerText().catch(() => ''), logs.slice(-15));
    throw error;
  }
  await page.evaluate(({ name, solo }) => {
    const input = document.getElementById('name-input');
    if (input) {
      input.value = name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.getElementById(solo ? 'solo-btn' : 'multi-btn')?.click();
  }, { name, solo: mode === 'solo' });
  await page.locator('#you-name').waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1200);
  return { page, logs };
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  console.log('shot', name);
}

if (phase === 'smoke') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  await page.waitForTimeout(6000);
  const city = await page.evaluate(() => window.__cityDebug);
  await shot(page, 'r6-smoke-1440');
  writeFileSync(`${OUT}/r6-smoke-log.json`, JSON.stringify({ city, logs }, null, 2));
  console.log(JSON.stringify({ city, errors: logs.filter((l) => /error|fail|http/.test(l.type)) }, null, 2));
  await ctx.close();
}

if (phase === 'angles') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  await page.waitForTimeout(5000);
  await page.locator('#scene').hover();
  for (let i = 0; i < 4; i += 1) {
    await shot(page, `r6-board-angle-${i}`);
    await page.keyboard.press('e');
    await page.waitForTimeout(650);
  }
  // Close view (two wheel ticks) and far view.
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -260);
  await page.waitForTimeout(350);
  await page.mouse.wheel(0, -260);
  await page.waitForTimeout(900);
  await shot(page, 'r6-board-zoom-close');
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(1100);
  await shot(page, 'r6-board-zoom-far');
  const city = await page.evaluate(() => window.__cityDebug);
  writeFileSync(`${OUT}/r6-angles-log.json`, JSON.stringify({ city, logs }, null, 2));
  console.log(JSON.stringify({ city, errors: logs.filter((l) => /error|fail|http/.test(l.type)).slice(0, 20) }, null, 2));
  await ctx.close();
}

if (phase === 'diag') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => ({
    settings: localStorage.getItem('chromonopoly.settings'),
    sky: window.__sky?.state,
    camera: window.__stage?.camera.position.toArray(),
    rig: window.__stage ? { yaw: window.__stage.rig.yaw, pitch: window.__stage.rig.pitch, radius: window.__stage.rig.radius } : null,
    stats: window.__cityStats?.(window.__stage?.camera),
  }));
  const far = info.stats.filter((s) => Math.hypot(s.x, s.z) > 50);
  const tall = info.stats.filter((s) => s.h > 8);
  console.log(JSON.stringify({ settings: info.settings, sky: info.sky, camera: info.camera, rig: info.rig, groups: info.stats.length, far: far.slice(0, 12), farCount: far.length, tallCount: tall.length }, null, 2));
  // Tilt down to the horizon: the skyline wall and sky must both be visible.
  await page.evaluate(() => {
    const rig = window.__stage?.rig;
    if (!rig) return;
    rig.orbit(0, -2000);
    rig.zoom(150);
  });
  await page.waitForTimeout(2000);
  const horizon = await page.evaluate(() => ({
    rig: window.__stage ? { yaw: window.__stage.rig.yaw, pitch: window.__stage.rig.pitch, radius: window.__stage.rig.radius } : null,
    sky: window.__sky?.state,
    stats: window.__cityStats?.(window.__stage?.camera),
  }));
  writeFileSync(`${OUT}/r6-diag-log.json`, JSON.stringify({ info, horizon, logs }, null, 2));
  console.log(JSON.stringify({ rig: horizon.rig, sky: horizon.sky, skylineInView: horizon.stats?.filter((s) => Math.hypot(s.x, s.z) > 55 && s.screen && Math.abs(s.screen.x) <= 1 && s.screen.y >= -1 && s.screen.y <= 1 && s.screen.z < 1).length }, null, 2));
  await shot(page, 'r6-horizon');
  await ctx.close();
}

if (phase === 'skyviews') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  await page.waitForTimeout(3500);
  const look = async (hour) => {
    await page.evaluate((h) => {
      window.__sky?.setRunning(false);
      window.__sky?.setHour(h);
      const rig = window.__stage?.rig;
      rig?.reset();
      rig?.orbit(0, -2000);
      rig?.zoom(150);
    }, hour);
    await page.waitForTimeout(1600);
    return page.evaluate(() => ({
      sky: window.__sky?.state,
      rig: window.__stage ? { pitch: window.__stage.rig.pitch, radius: window.__stage.rig.radius } : null,
    }));
  };
  const sunset = await look(17);
  await shot(page, 'r6-sunset');
  const twilight = await look(19.2);
  await shot(page, 'r6-moon');
  const night = await look(23);
  await shot(page, 'r6-night-sky');
  writeFileSync(`${OUT}/r6-skyviews-log.json`, JSON.stringify({ sunset, twilight, night, logs }, null, 2));
  console.log(JSON.stringify({ sunset: sunset.sky.phase, twilight: twilight.sky.phase, night: night.sky.phase, nightTop: night.sky.top, errors: logs.filter((l) => /error|fail|http/.test(l.type)).slice(0, 10) }, null, 2));
  await ctx.close();
}

if (phase === 'night-ui') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.waitForTimeout(700);
  const chip = await page.locator('.chip').filter({ hasText: /Night/ }).allInnerTexts();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(1200);
  const sky = await page.evaluate(() => window.__sky?.state);
  const settings = await page.evaluate(() => localStorage.getItem('chromonopoly.settings'));
  console.log(JSON.stringify({ chip, sky, settings }, null, 2));
  await shot(page, 'r6-night-ui');
  writeFileSync(`${OUT}/r6-night-ui-log.json`, JSON.stringify({ chip, sky, settings, logs }, null, 2));
  await ctx.close();
}

if (phase === 'night') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    window.__sky?.setRunning(false);
    window.__sky?.setHour(23);
    const rig = window.__stage?.rig;
    rig?.orbit(0, -2000);
    rig?.zoom(150);
  });
  await page.waitForTimeout(1600);
  await shot(page, 'r6-night-sky');
  await page.keyboard.press('e');
  await page.waitForTimeout(700);
  await shot(page, 'r6-night-angle');
  const sky = await page.evaluate(() => window.__sky?.state);
  writeFileSync(`${OUT}/r6-night-log.json`, JSON.stringify({ sky, logs }, null, 2));
  await ctx.close();
}

if (phase === 'owners') {
  const players = [];
  for (const [i, name] of ['Ada', 'Grace'].entries()) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // Owner signs are a board feature; skip the 650-building city here so four
    // simultaneous pages fit in the software renderer.
    const p = await join(ctx, name, 'multi', '?e2e');
    players.push({ ctx, ...p, name });
    if (i === 0) await p.page.waitForTimeout(2500);
  }
  const groupTiles = [[1, 6], [11, 16]];
  for (let i = 0; i < players.length; i += 1) {
    const p = players[i];
    const session = await p.page.evaluate(() => localStorage.getItem('chromonopoly.session'));
    for (const tile of groupTiles[i]) {
      const res = await fetch(`${BASE}/api/test/scenario`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session, mode: 'multi', setup: { kind: 'build', tile, cash: 5000 } }),
      });
      console.log('build', p.name, tile, res.status, await res.text());
      await p.page.waitForTimeout(350);
    }
  }
  const p0 = players[0].page;
  await p0.waitForTimeout(1200);
  await shot(p0, 'r6-owners-default');
  await p0.mouse.move(720, 450);
  await p0.mouse.wheel(0, -300);
  await p0.waitForTimeout(260);
  await p0.mouse.wheel(0, -300);
  await p0.waitForTimeout(1000);
  await shot(p0, 'r6-owners-close');
  const logs = players.flatMap((p) => p.logs);
  writeFileSync(`${OUT}/r6-owners-log.json`, JSON.stringify(logs, null, 2));
  console.log(JSON.stringify({ errors: logs.filter((l) => /error|fail|http/.test(l.type)).slice(0, 20) }, null, 2));
  for (const p of players) await p.ctx.close();
}

if (phase === 'chance') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof', 'multi', '?e2e');
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const owner = await join(ownerCtx, 'Owner', 'multi', '?e2e');
  const ownerSession = await owner.page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  const res = await fetch(`${BASE}/api/test/scenario`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session, mode: 'multi', setup: { kind: 'rent', tile: 39, ownerSession, building: 'house', cash: 2000, roll: 0.99 } }),
  });
  console.log('rent', res.status, await res.text());
  await page.locator('#pending-sheet').waitFor({ state: 'visible', timeout: 15000 });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('#pending-sheet button')].find((el) => /Try to evade/.test(el.textContent ?? ''));
    button?.click();
  });
  const meter = page.locator('#chance-overlay');
  await meter.waitFor({ state: 'visible', timeout: 20000 });
  await shot(page, 'r6-chance-wheel');
  const percent = await meter.getAttribute('data-chance');
  await page.bringToFront();
  // Measure inside the page: Playwright's click waits for the animated button
  // to stop moving, which inflated the wall-clock duration by ~20 seconds.
  const spin = await page.evaluate(async () => {
    const overlay = document.querySelector('#chance-overlay');
    const dial = overlay?.querySelector('.chance-dial');
    const button = [...(overlay?.querySelectorAll('button') ?? [])].find((el) => /^Spin$/.test(el.textContent?.trim() ?? ''));
    if (!dial || !button) return { error: 'no wheel' };
    const start = performance.now();
    const samples = [];
    button.click();
    await new Promise((resolve) => {
      const timer = window.setInterval(() => {
        const t = performance.now() - start;
        const m = new DOMMatrixReadOnly(getComputedStyle(dial).transform);
        samples.push({ t: Math.round(t), angle: (Math.atan2(m.b, m.a) * 180) / Math.PI });
        const cont = overlay?.querySelector('.chance-continue');
        const done = cont && cont.getBoundingClientRect().width > 0;
        if (done || t > 15000) {
          window.clearInterval(timer);
          resolve(null);
        }
      }, 50);
    });
    let previous = samples[0]?.angle ?? 0;
    let swept = 0;
    for (const sample of samples.slice(1)) {
      let delta = sample.angle - previous;
      delta = ((delta + 540) % 360) - 180;
      swept += delta;
      previous = sample.angle;
    }
    return {
      duration: Math.round(performance.now() - start),
      turns: Number((swept / 360).toFixed(2)),
      samples,
      result: overlay?.querySelector('.chance-result')?.textContent ?? '',
    };
  });
  await shot(page, 'r6-chance-result');
  const result = spin.result ?? (await meter.locator('.chance-result').innerText());
  writeFileSync(`${OUT}/r6-chance-log.json`, JSON.stringify({ percent, spin, logs }, null, 2));
  console.log(JSON.stringify({ percent, duration: spin.duration, turns: spin.turns, result, samples: spin.samples?.length, first: spin.samples?.[0], last: spin.samples?.[spin.samples.length - 1] }, null, 2));
  await ctx.close();
  await ownerCtx.close();
}

if (phase === 'jail') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  const res = await fetch(`${BASE}/api/test/scenario`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session, mode: 'multi', setup: { kind: 'jail', tile: 37, cash: 5000 } }),
  });
  console.log('jail', res.status, await res.text());
  await page.waitForTimeout(1400);
  // The jail sentence emits a property-sale wheel after the scenario has
  // already returned. Wait for that delayed event, dismiss it, and only then
  // capture the actual 3D cage. If a wheel is still queued at the end, remove
  // the overlay (not the game state) so the cage is visible in the proof.
  await page.waitForTimeout(6000);
  for (let guard = 0; guard < 3; guard += 1) {
    const jailWheel = page.locator('#chance-overlay');
    if (!(await jailWheel.isVisible().catch(() => false))) break;
    await page.bringToFront();
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('#chance-overlay button')].find((el) => /^Spin$/.test(el.textContent?.trim() ?? ''));
      button?.click();
    });
    await jailWheel.locator('.chance-continue').waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('#chance-overlay button')].find((el) => /^Continue$/.test(el.textContent?.trim() ?? ''));
      button?.click();
    });
    await jailWheel.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => document.getElementById('chance-overlay')?.remove());
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('chromonopoly:focus')));
  await page.waitForTimeout(900);
  await shot(page, 'r6-jail-cage');
  writeFileSync(`${OUT}/r6-jail-log.json`, JSON.stringify(logs, null, 2));
  await ctx.close();
}

if (phase === 'cards') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, logs } = await join(ctx, 'Proof');
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  for (const deck of ['chance', 'chest']) {
    const card = page.locator('#card-draw');
    const visible = card.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    const res = await fetch(`${BASE}/api/test/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, mode: 'multi', setup: { kind: 'card', deck } }),
    });
    console.log('card', deck, res.status, await res.text());
    // The card sheet auto-closes after 3.2 s. Wait for it before screenshotting;
    // a fixed delay could miss a slow server event entirely.
    const shown = await visible;
    console.log('card visible', deck, shown);
    if (shown) await shot(page, `r6-card-${deck}`);
    await card.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  writeFileSync(`${OUT}/r6-cards-log.json`, JSON.stringify(logs, null, 2));
  await ctx.close();
}

if (phase === 'turns') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const { page, logs } = await join(ctx, 'Proof', 'multi', '?e2e');
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  // A second account owns every colour group, so rent/evade occurs often.
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const owner = await join(ownerCtx, 'Landlord', 'multi', '?e2e');
  const ownerSession = await owner.page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  for (const tile of [1, 6, 11, 16, 21, 26, 31, 36]) {
    await fetch(`${BASE}/api/test/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: ownerSession, mode: 'multi', setup: { kind: 'build', tile, cash: 5000 } }),
    });
  }
  await page.waitForTimeout(500);
  const turns = [];
  for (let i = 0; i < 10; i += 1) {
    const before = await page.evaluate(() => ({
      pos: window.__flowState,
      move: (window.__moveLog ?? []).length,
      log: (window.__turnLog ?? []).length,
    }));
    await page.locator('#roll-btn').click();
    await page.waitForFunction(
      () => window.__flowState === 'TILE_PROMPT' || window.__flowState === 'IDLE',
      { timeout: 25000 },
    );
    const snap = await page.evaluate(() => ({
      pos: window.__flowState,
      turnLog: window.__turnLog ?? [],
      moveLog: (window.__moveLog ?? []).slice(-1),
      name: document.querySelector('#you-name')?.textContent,
      title: document.querySelector('.rail-row.turn .rail-name')?.textContent,
    }));
    turns.push({ ...snap, before });
    console.log('turn', i, snap.turnLog.map((s) => s.state).join(' > '), snap.moveLog[0]?.distance, snap.moveLog[0]?.tileName);
    // Resolve whatever prompt opened.
    for (let guard = 0; guard < 6; guard += 1) {
      const chance = page.locator('#chance-overlay');
      if (await chance.isVisible().catch(() => false)) {
        await page.evaluate(() => {
          const button = [...document.querySelectorAll('#chance-overlay button')].find((el) => /^Spin$/.test(el.textContent?.trim() ?? ''));
          button?.click();
        });
        await chance.locator('.chance-continue').waitFor({ state: 'visible', timeout: 15000 });
        await page.evaluate(() => {
          const button = [...document.querySelectorAll('#chance-overlay button')].find((el) => /^Continue$/.test(el.textContent?.trim() ?? ''));
          button?.click();
        });
        await chance.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(250);
        continue;
      }
      const pending = page.locator('#pending-sheet');
      if (await pending.isVisible().catch(() => false)) {
        await page.evaluate(() => {
          const buttons = [...document.querySelectorAll('#pending-sheet button')];
          const pass = buttons.find((el) => /^Pass$/.test(el.textContent?.trim() ?? ''));
          const pay = buttons.find((el) => /^Pay /.test(el.textContent?.trim() ?? ''));
          const evade = buttons.find((el) => /^Try to evade$/.test(el.textContent?.trim() ?? ''));
          (pass ?? pay ?? evade)?.click();
        });
        await page.waitForTimeout(350);
        continue;
      }
      const card = page.locator('#card-draw');
      if (await card.isVisible().catch(() => false)) {
        await page.evaluate(() => document.getElementById('card-draw')?.click());
        await page.waitForTimeout(250);
        continue;
      }
      const jailCard = page.locator('#jail-card');
      if (await jailCard.isVisible().catch(() => false)) {
        await page.evaluate(() => {
          const button = [...document.querySelectorAll('#jail-card button')].find((el) => /^Pay /.test(el.textContent?.trim() ?? ''));
          button?.click();
        });
        await page.waitForTimeout(250);
        continue;
      }
      break;
    }
    await page.waitForTimeout(350);
  }
  await shot(page, 'r6-turns-final');
  writeFileSync(`${OUT}/r6-turns-log.json`, JSON.stringify({ session, turns, logs }, null, 2));
  const summary = turns.map((t) => ({
    states: t.turnLog.map((s) => s.state),
    distance: t.moveLog[0]?.distance,
    tile: t.moveLog[0]?.logicTileIndex,
    name: t.moveLog[0]?.tileName,
  }));
  console.log(JSON.stringify(summary, null, 2));
  await ctx.close();
  await ownerCtx.close();
}

await browser.close();
