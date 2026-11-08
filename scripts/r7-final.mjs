import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const OUT = 'docs/round7-proof';
const lines = [];
const say = (...x) => { const s = x.join(' '); lines.push(s); console.log(s); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const closeAny = async () => {
  const close = page.getByRole('button', { name: 'Close', exact: true }).first();
  if (await close.isVisible().catch(() => false)) await close.click({ force: true });
  await page.waitForTimeout(300);
};
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); say('shot', name); };
const reset = async () => {
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.waitForTimeout(900);
};

await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'round7_mw86itaa');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
await page.waitForTimeout(1200);
say('login', await page.locator('#you-name').innerText());

// Same shared card in Properties and in the tile sheet.
await page.getByRole('button', { name: 'Properties', exact: true }).click();
await page.waitForTimeout(600);
await shot('r7-properties-card');
const propsCard = (await page.locator('.deed-card').first().innerText()).trim();
const owned = await page.locator('.deed-wrap[data-tile]').first().getAttribute('data-tile');
say('properties_tile', String(owned));
say('properties_card', JSON.stringify(propsCard.slice(0, 380)));
await closeAny();
let ownerTile = owned === null ? 5 : Number(owned);
if (owned !== null) {
  const p = await page.evaluate((tile) => window.__tileScreen(Number(tile)), owned);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(700);
  const tileCard = (await page.locator('.deed-card').first().innerText()).trim();
  say('tile_sheet_card', JSON.stringify(tileCard.slice(0, 380)));
  say('cards_identical', String(tileCard === propsCard));
  await shot('r7-tile-card');
  await closeAny();
}

// Owner sign close-up, zoomed toward the owned tile.
const p = await page.evaluate((tile) => window.__tileScreen(Number(tile)), ownerTile);
await page.mouse.move(p.x, p.y);
for (let i = 0; i < 5; i += 1) { await page.mouse.wheel(0, -700); await page.waitForTimeout(120); }
await page.waitForTimeout(900);
await shot('r7-owner-sign-close');
await reset();

// Follow camera: turn it on, then catch the piece while it is moving.
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(400);
const followSwitch = page.getByRole('switch', { name: 'Follow camera' });
if (await followSwitch.getAttribute('aria-checked') !== 'true') await followSwitch.click();
await closeAny();
await page.getByRole('button', { name: /^ROLL$/ }).first().click();
const moving = await page.waitForFunction(() => window.__flowState === 'PIECE_MOVING', null, { timeout: 9000 }).then(() => true, () => false);
await page.waitForTimeout(350);
const cam = await page.evaluate(() => ({ state: window.__flowState, radius: Number(window.__stage.rig.radius.toFixed(2)), pitchDeg: Number((window.__stage.rig.pitch * 180 / Math.PI).toFixed(1)) }));
say('follow_moving', String(moving), JSON.stringify(cam));
await shot('r7-follow-camera');
await page.waitForTimeout(2200);
await closeAny();

// Four close-up board sides so every tile type is visible at large size.
for (const [tile, name] of [[5, 'north'], [15, 'east'], [25, 'south'], [35, 'west']]) {
  await reset();
  const point = await page.evaluate((t) => window.__tileScreen(t), tile);
  await page.mouse.move(point.x, point.y);
  for (let i = 0; i < 4; i += 1) { await page.mouse.wheel(0, -700); await page.waitForTimeout(100); }
  await page.waitForTimeout(700);
  await shot(`r7-tiles-${name}`);
}
await reset();

// Robbery result, then inspect the public log.
await page.getByRole('button', { name: 'Underworld', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Plan heist' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Review heist' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /attempt the robbery/i }).click();
const resultShown = await page.waitForSelector('.crime-result-card', { timeout: 12000 }).then(() => true, () => false);
await page.waitForTimeout(600);
const resultText = resultShown ? await page.locator('.crime-result-card').innerText() : await page.locator('body').innerText();
say('robbery_result_shown', String(resultShown));
say('robbery_result', JSON.stringify(resultText.slice(0, 500)));
await shot('r7-robbery-result');
await closeAny();
await page.getByRole('button', { name: 'Log', exact: true }).click();
await page.waitForTimeout(700);
const logText = await page.locator('[role="dialog"]').innerText();
say('log_has_jail_record', String(/jail|record|robb/i.test(logText)));
say('log_after_robbery', JSON.stringify(logText.slice(0, 600)));
await shot('r7-log-after-robbery');
await closeAny();
say('errors', JSON.stringify(errors.slice(-10)));
writeFileSync(`${OUT}/final-proof.log`, lines.join('\n') + '\n');
await browser.close();
