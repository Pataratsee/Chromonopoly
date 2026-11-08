import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const BASE = 'http://127.0.0.1:8787';
const username = 'amy';
const password = process.env.R7_PASSWORD;

const register = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
console.log('register', register.status, await register.text());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', username);
await page.fill('#auth-password', password);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
await page.waitForTimeout(1200);

const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
const setup = await fetch(`${BASE}/api/test/scenario`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    session,
    mode: 'multi',
    setup: { kind: 'rent', tile: 1, ownerSession: session, cash: 5000 },
  }),
});
console.log('rent setup', setup.status, await setup.text());
await page.waitForTimeout(900);

const pay = page.getByRole('button', { name: /^(Pay|Pay rent)/ }).first();
if (await pay.isVisible().catch(() => false)) {
  console.log('pay pending', await pay.innerText());
  await pay.click();
  await page.waitForTimeout(1200);
}
const close = page.getByRole('button', { name: 'Close', exact: true }).first();
if (await close.isVisible().catch(() => false)) await close.click({ force: true });

await page.getByRole('button', { name: 'Properties', exact: true }).click();
await page.waitForTimeout(900);
const mine = page.locator('[role="dialog"] [data-tab="mine"]');
if (await mine.isVisible().catch(() => false)) await mine.click();
await page.waitForTimeout(600);
const deeds = page.locator('[role="dialog"] [data-tile]');
console.log('owned deed cards', await deeds.count());
const deed = page.locator('[role="dialog"] [data-tile="1"]');
const buildHere = deed.getByRole('button', { name: 'Build here', exact: true });
console.log('single-street build visible', await buildHere.isVisible().catch(() => false));
await buildHere.click();
await page.waitForTimeout(900);
const grid = page.locator('[role="dialog"] .build-grid');
console.log('build choices', await grid.locator('button').count());
await grid.locator('button', { hasText: 'Build' }).first().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/r7-build-single-street-sheet.png` });
await page.getByRole('button', { name: 'Close', exact: true }).first().click({ force: true });
await page.waitForTimeout(700);

const point = await page.evaluate(() => window.__tilePoint(1));
await page.evaluate((p) => {
  const rig = window.__stage.rig;
  rig.wantYaw = 0;
  rig.wantPitch = 0.62;
  rig.wantRadius = 5.2;
  rig.wantTarget.set(p.x, 0.2, p.z);
  rig.manualUntil = performance.now() + 100000;
}, point);
await page.evaluate(() => window.__stage.rig.whenSettled(3500));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/r7-build-single-street.png` });
writeFileSync(`${OUT}/single-street-build.log`, `owned_deeds=${await deeds.count()}\nsingle_street_build_visible=true\nbuild_choices=${await grid.locator('button').count().catch(() => 0)}\nerrors=${JSON.stringify(errors.slice(-5))}\n`);
console.log('errors', errors.slice(-5));
await browser.close();
