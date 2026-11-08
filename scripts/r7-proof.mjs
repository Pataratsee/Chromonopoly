import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const log = [];
const say = (...x) => { const line = x.join(' '); log.push(line); console.log(line); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const closeAny = async () => {
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.first().isVisible().catch(() => false)) await close.first().click();
  await page.waitForTimeout(250);
};
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); say('shot', `${OUT}/${name}.png`); };

await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'round7_mw86itaa');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
say('login_ok', await page.locator('#you-name').innerText());
await page.waitForTimeout(1200);
await shot('r7-board-default');

// Closest zoom and reset.
await page.locator('#scene').hover({ position: { x: 640, y: 300 } });
await page.mouse.wheel(0, -2400);
await page.waitForTimeout(1200);
await shot('r7-zoom-closest');
await page.getByRole('button', { name: 'Reset camera' }).click();
await page.waitForTimeout(900);

// Buy the first property we land on, so the shared deed card has a real owner.
let boughtTile = null;
for (let attempt = 0; attempt < 14 && boughtTile === null; attempt += 1) {
  const roll = page.getByRole('button', { name: /^ROLL$/ }).first();
  if (!(await roll.isEnabled().catch(() => false))) { await page.waitForTimeout(1500); continue; }
  await roll.click();
  const buy = page.getByRole('button', { name: /^Buy \$/ }).first();
  const appeared = await buy.waitFor({ state: 'visible', timeout: 9000 }).then(() => true, () => false);
  if (appeared) {
    say('buy_prompt', await buy.innerText());
    await buy.click();
    await page.waitForTimeout(900);
    boughtTile = await page.evaluate(() => {
      const wrap = document.querySelector('.deed-wrap[data-tile]');
      return wrap ? Number(wrap.getAttribute('data-tile')) : null;
    });
  }
  await closeAny();
}
say('bought_tile_visible', String(boughtTile));

// Properties tab: shared property card.
await page.getByRole('button', { name: 'Properties' }).click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(700);
await shot('r7-properties-card');
const propsCardText = await page.locator('.deed-card').first().innerText().catch(() => '');
const ownedTile = await page.locator('.deed-wrap[data-tile]').first().getAttribute('data-tile').catch(() => null);
say('properties_card', JSON.stringify(propsCardText.slice(0, 500)));
say('owned_tile', String(ownedTile));
await closeAny();

// Same card in the tile sheet.
if (ownedTile !== null) {
  const point = await page.evaluate((tile) => window.__tileScreen(Number(tile)), ownedTile);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(800);
  const tileCardText = await page.locator('.deed-card').first().innerText().catch(() => '');
  say('tile_sheet_card', JSON.stringify(tileCardText.slice(0, 500)));
  say('cards_identical', String(tileCardText.trim() === propsCardText.trim()));
  await shot('r7-tile-card');
  await closeAny();
  const p2 = await page.evaluate((tile) => window.__tileScreen(Number(tile)), ownedTile);
  await page.screenshot({ path: `${OUT}/r7-owner-sign.png`, clip: { x: Math.max(0, p2.x - 90), y: Math.max(0, p2.y - 75), width: 180, height: 150 } });
  say('shot', `${OUT}/r7-owner-sign.png`);
}

// Bank: live limit and an error above the limit on top of the sheet.
await page.getByRole('button', { name: 'Bank' }).click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(500);
say('bank_sheet', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 500)));
await shot('r7-bank-limit');
await page.locator('[role="dialog"] input[type="number"]').first().fill('999999');
await page.getByRole('button', { name: 'Borrow', exact: true }).click();
await page.waitForTimeout(900);
const toastTexts = await page.locator('.toast, #toast-layer *').allInnerTexts().catch(() => []);
say('loan_error_toasts', JSON.stringify(toastTexts.filter(Boolean).slice(0, 6)));
const zIndex = await page.evaluate(() => {
  const layer = document.querySelector('#toast-layer');
  return layer ? { id: layer.id, z: getComputedStyle(layer).zIndex, text: layer.textContent?.trim() } : null;
});
say('toast_layer', JSON.stringify(zIndex));
await shot('r7-bank-error-on-top');
await closeAny();

// Underworld robbery: both slider ends and warning.
await page.getByRole('button', { name: 'Underworld' }).click();
await page.getByRole('button', { name: 'Plan heist' }).click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(400);
say('robbery_min', await page.locator('.heist-odds').innerText(), await page.locator('.heist-take').innerText());
await shot('r7-robbery-min');
await page.locator('input[aria-label="Heist amount"]').evaluate((el) => {
  el.value = '100000';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(300);
say('robbery_max', await page.locator('.heist-odds').innerText(), await page.locator('.heist-take').innerText());
await shot('r7-robbery-max');
await page.getByRole('button', { name: 'Review heist' }).click();
await page.waitForTimeout(500);
await shot('r7-robbery-warning');
say('warning', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 400)));
await closeAny();

// Detective tab.
await page.getByRole('button', { name: 'Detective' }).click();
await page.waitForTimeout(500);
await shot('r7-detective');
say('detective', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 300)));
await closeAny();

// Logs: main, player logs, market feed.
await page.getByRole('button', { name: 'Log' }).click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(500);
await shot('r7-log-main');
await page.getByRole('button', { name: 'Player logs', exact: true }).click();
await page.waitForTimeout(400);
await shot('r7-log-players');
const playerRows = await page.locator('.player-log-row').count();
say('player_log_rows', String(playerRows));
if (playerRows) {
  await page.locator('.player-log-row').first().click();
  await page.waitForTimeout(400);
  await shot('r7-log-player-detail');
  say('player_log_detail', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 400)));
}
await page.getByRole('button', { name: 'Market feed', exact: true }).click();
await page.waitForTimeout(400);
await shot('r7-log-market');
say('market', JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 300)));
await closeAny();

// Four sky times: the board must not change.
for (const preset of ['Sunrise', 'Noon', 'Sunset', 'Night']) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForSelector('[role="dialog"]');
  if (preset === 'Sunrise') {
    const reduced = page.getByRole('switch', { name: 'Reduced motion' });
    if (await reduced.getAttribute('aria-checked') !== 'true') await reduced.click();
  }
  await page.getByRole('button', { name: preset, exact: true }).click();
  await closeAny();
  await page.waitForTimeout(900);
  await shot(`r7-sky-${preset.toLowerCase()}`);
}

say('page_errors', JSON.stringify(errors.slice(-20)));
writeFileSync(`${OUT}/ui-proof.log`, log.join('\n') + '\n');
await browser.close();
