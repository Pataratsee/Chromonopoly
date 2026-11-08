import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

const closeAny = async () => {
  const close = page.getByRole('button', { name: 'Close', exact: true }).first();
  if (await close.isVisible().catch(() => false)) await close.click({ force: true });
  await page.waitForTimeout(300);
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
await closeAny();

const release = page.getByRole('button', { name: 'Pay release', exact: true });
if (await release.isVisible().catch(() => false)) {
  await release.click();
  await page.waitForTimeout(1800);
  console.log('released jail');
}

await page.getByRole('button', { name: 'Properties', exact: true }).click();
await page.waitForTimeout(1000);
const mine = page.locator('[role="dialog"] [data-tab="mine"]');
if (await mine.isVisible().catch(() => false)) await mine.click();
await page.waitForTimeout(800);
const deed = page.locator('[role="dialog"] [data-tile="11"]');
if (!(await deed.count())) {
  console.log('ST_CHARLES_NOT_FOUND', (await page.locator('[role="dialog"]').innerText()).slice(0, 700));
  await page.screenshot({ path: `${OUT}/r7-owner-sign-properties.png` });
  await browser.close();
  process.exit(1);
}
const unmortgage = deed.getByRole('button', { name: /^Unmortgage / });
if (await unmortgage.isVisible().catch(() => false)) {
  console.log('unmortgage', await unmortgage.innerText());
  await unmortgage.click();
  await page.waitForTimeout(1600);
} else {
  console.log('already unmortgaged');
}
await closeAny();

await page.evaluate(() => window.dispatchEvent(new CustomEvent('chromonopoly:camera', { detail: 'reset' })));
await page.waitForTimeout(700);
const point = await page.evaluate(() => window.__tilePoint(11));
await page.evaluate((p) => {
  const rig = window.__stage.rig;
  rig.wantYaw = 2.42;
  rig.wantPitch = 0.62;
  rig.wantRadius = 4.4;
  rig.wantTarget.set(p.x, 0.2, p.z);
  rig.manualUntil = performance.now() + 100000;
}, point);
await page.evaluate(() => window.__stage.rig.whenSettled(3500));
await page.waitForTimeout(600);
console.log('camera', await page.evaluate(() => ({
  radius: window.__stage.rig.radius,
  target: window.__stage.rig.target.toArray(),
  point: window.__tilePoint(11),
})));
await page.screenshot({ path: `${OUT}/r7-owner-sign-long.png` });
const state = await page.evaluate(() => ({
  cash: document.querySelector('#you-cash')?.textContent,
  net: document.querySelector('#you-net')?.textContent,
  jailed: Boolean(document.querySelector('#jail-card')),
}));
writeFileSync(`${OUT}/owner-sign.log`, `${JSON.stringify(state)}\nerrors=${JSON.stringify(errors.slice(-5))}\n`);
console.log('state', state);
console.log('errors', errors.slice(-5));
await browser.close();
