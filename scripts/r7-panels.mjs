import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const lines = [];
const say = (...x) => { const s = x.join(' '); lines.push(s); console.log(s); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const closeAny = async () => {
  const close = page.getByRole('button', { name: 'Close', exact: true }).first();
  if (await close.isVisible().catch(() => false)) await close.click({ force: true });
  await page.waitForTimeout(300);
};
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); say('shot', name); };

await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'round7_mw86itaa');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
say('login', await page.locator('#you-name').innerText());
await page.waitForTimeout(800);

// Bank: borrow above the limit and inspect the top layer immediately.
await page.getByRole('button', { name: 'Bank', exact: true }).click();
await page.waitForTimeout(500);
const bankText = await page.locator('[role="dialog"]').innerText();
say('bank_limit_line', bankText.split('\n').find((l) => l.includes('$10,000')) ?? 'not found');
await page.locator('[role="dialog"] input[type="number"]').first().fill('999999');
await page.getByRole('button', { name: 'Borrow', exact: true }).click();
await page.waitForTimeout(700);
const toast = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('.toast')];
  const layer = document.querySelector('.toast-layer');
  return {
    count: nodes.length,
    texts: nodes.map((n) => n.textContent),
    layerZ: layer ? getComputedStyle(layer).zIndex : null,
    layerTop: layer ? getComputedStyle(layer).top : null,
    sheetZ: (() => { const s = document.querySelector('.sheet-layer'); return s ? getComputedStyle(s).zIndex : null; })(),
  };
});
say('toast', JSON.stringify(toast));
await shot('r7-bank-error-on-top');
await closeAny();

// Robbery both ends.
await page.getByRole('button', { name: 'Underworld', exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Plan heist' }).click();
await page.waitForTimeout(500);
say('robbery_min', await page.locator('.heist-odds').innerText());
await shot('r7-robbery-min');
await page.locator('input[aria-label="Heist amount"]').evaluate((el) => {
  el.value = '100000';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(300);
say('robbery_max', await page.locator('.heist-odds').innerText());
await shot('r7-robbery-max');
await page.getByRole('button', { name: 'Review heist' }).click();
await page.waitForTimeout(400);
say('warning', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 350)));
await shot('r7-robbery-warning');
await closeAny();

// Detective is its own dock tab.
await page.getByRole('button', { name: 'Detective', exact: true }).click();
await page.waitForTimeout(500);
say('detective_text', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 250)));
await shot('r7-detective');
await closeAny();

// Logs.
await page.getByRole('button', { name: 'Log', exact: true }).click();
await page.waitForTimeout(500);
await shot('r7-log-main');
await page.getByRole('button', { name: 'Player logs', exact: true }).click();
await page.waitForTimeout(400);
say('player_rows', String(await page.locator('.player-log-row').count()));
await shot('r7-log-players');
if (await page.locator('.player-log-row').count()) {
  await page.locator('.player-log-row').first().click();
  await page.waitForTimeout(400);
  say('player_detail', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 300)));
  await shot('r7-log-player-detail');
}
await page.getByRole('button', { name: 'Market feed', exact: true }).click();
await page.waitForTimeout(400);
say('market_text', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 300)));
await shot('r7-log-market');
await closeAny();

// Owner sign close-up: zoom toward the owned railroad tile.
const owned = await page.evaluate(() => document.querySelector('.deed-wrap[data-tile]')?.getAttribute('data-tile') ?? null);
say('owned_tile', String(owned));
if (owned !== null) {
  const p = await page.evaluate((tile) => window.__tileScreen(Number(tile)), owned);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -1600);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/r7-owner-sign-close.png` });
  say('shot', 'r7-owner-sign-close');
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.waitForTimeout(800);
}

// Four sky presets; board crop comparison is done by the Python check.
for (const preset of ['Sunrise', 'Noon', 'Sunset', 'Night']) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(400);
  if (preset === 'Sunrise') {
    const reduced = page.getByRole('switch', { name: 'Reduced motion' });
    if (await reduced.getAttribute('aria-checked') !== 'true') await reduced.click();
  }
  await page.getByRole('button', { name: preset, exact: true }).click();
  await closeAny();
  await page.waitForTimeout(800);
  await shot(`r7-sky-${preset.toLowerCase()}`);
}
say('errors', JSON.stringify(errors.slice(-10)));
writeFileSync(`${OUT}/panels-proof.log`, lines.join('\n') + '\n');
await browser.close();
