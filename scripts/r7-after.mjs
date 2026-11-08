import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const OUT = 'docs/round7-proof';
const lines = [];
const say = (...x) => { const s = x.join(' '); lines.push(s); console.log(s); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const closeAny = async () => {
  const close = page.getByRole('button', { name: 'Close', exact: true }).first();
  if (await close.isVisible().catch(() => false)) await close.click({ force: true });
  await page.waitForTimeout(250);
};
const clearPending = async () => {
  for (let i = 0; i < 3 && await page.locator('#pending-overlay').count(); i += 1) {
    const b = page.getByRole('button', { name: /^(Decline|Pay|Try to evade|Buy)/ }).first();
    if (await b.isVisible().catch(() => false)) await b.click({ force: true });
    await page.waitForTimeout(400);
  }
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
await clearPending();

const chance = await page.locator('#chance-overlay').count();
say('chance_overlay_on_load', String(chance));
if (chance) {
  const spin = page.locator('.chance-spin');
  if (await spin.isVisible().catch(() => false)) { await spin.click({ force: true }); await page.waitForTimeout(1300); }
  const cont = page.locator('.chance-continue');
  if (await cont.isVisible().catch(() => false)) { await cont.click({ force: true }); await page.waitForTimeout(500); }
}
say('chance_overlay_after', String(await page.locator('#chance-overlay').count()));

await page.getByRole('button', { name: 'Log', exact: true }).click();
await page.waitForTimeout(700);
const logText = await page.locator('[role="dialog"]').innerText();
say('log_has_jail_record', String(/jail|record/i.test(logText)));
say('log_mentions_robbery', String(/robb|heist/i.test(logText)));
say('log_after_robbery', JSON.stringify(logText.slice(0, 900)));
await page.screenshot({ path: `${OUT}/r7-log-after-robbery.png` });
say('shot', 'r7-log-after-robbery');
await closeAny();

// Card identity if the account still has a deed.
await page.getByRole('button', { name: 'Properties', exact: true }).click();
await page.waitForTimeout(600);
const card = page.locator('.deed-card').first();
if (await card.isVisible().catch(() => false)) {
  const props = (await card.innerText()).trim();
  const tileId = await page.locator('.deed-wrap[data-tile]').first().getAttribute('data-tile');
  say('properties_tile', String(tileId));
  say('properties_card', JSON.stringify(props.slice(0, 420)));
  await page.screenshot({ path: `${OUT}/r7-properties-card-after.png` });
  await closeAny();
  if (tileId !== null) {
    const p = await page.evaluate((tile) => window.__tileScreen(Number(tile)), tileId);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(600);
    const tileCard = (await page.locator('.deed-card').first().innerText()).trim();
    say('tile_sheet_card', JSON.stringify(tileCard.slice(0, 420)));
    say('cards_identical', String(tileCard === props));
    await closeAny();
  }
} else {
  say('properties_card', 'none after jail');
  await closeAny();
}
say('errors', JSON.stringify(errors.slice(-10)));
writeFileSync(`${OUT}/after-proof.log`, lines.join('\n') + '\n');
await browser.close();
