import { chromium } from '@playwright/test';
const OUT = 'docs/round7-proof';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(10000);
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
const reset = async () => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('chromonopoly:camera', { detail: 'reset' })));
  await page.waitForTimeout(800);
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
await clearPending();
await closeAny();
for (const [tile, name] of [[5, 'north'], [15, 'east'], [25, 'south'], [35, 'west']]) {
  await reset();
  const p = await page.evaluate((t) => window.__tileScreen(t), tile);
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < 4; i += 1) { await page.mouse.wheel(0, -700); await page.waitForTimeout(100); }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/r7-tiles-${name}.png` });
  console.log('captured', name);
}
await reset();
const signPoint = await page.evaluate(() => window.__tileScreen(11));
await page.mouse.move(signPoint.x, signPoint.y);
for (let i = 0; i < 5; i += 1) { await page.mouse.wheel(0, -700); await page.waitForTimeout(100); }
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/r7-owner-sign-close.png` });
console.log('captured sign');
await browser.close();
