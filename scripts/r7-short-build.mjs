import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const BASE = 'http://127.0.0.1:8787';
const username = 'bob';
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
page.on('dialog', (dialog) => dialog.dismiss());

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
  body: JSON.stringify({ session, mode: 'multi', setup: { kind: 'build', tile: 1, cash: 5000 } }),
});
console.log('build setup', setup.status, await setup.text());
await page.waitForTimeout(1200);

await page.getByRole('button', { name: 'Properties', exact: true }).click();
await page.waitForTimeout(900);
const mine = page.locator('[role="dialog"] [data-tab="mine"]');
if (await mine.isVisible().catch(() => false)) await mine.click();
await page.waitForTimeout(500);
const deed = page.locator('[role="dialog"] [data-tile="1"]');
const buildHere = deed.getByRole('button', { name: 'Build here', exact: true });
console.log('build here visible', await buildHere.isVisible().catch(() => false));
await buildHere.click();
await page.waitForTimeout(900);
const dialog = page.locator('[role="dialog"]');
const categories = await dialog.locator('.group-label').allInnerTexts();
const buttons = await dialog.locator('.build-grid button').count();
await page.screenshot({ path: `${OUT}/r7-build-grid.png` });
await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/r7-build-grid-bottom.png` });
console.log('build categories', categories);
console.log('build buttons', buttons);

await page.getByRole('button', { name: 'Close', exact: true }).first().click({ force: true });
await page.waitForTimeout(500);
const point = await page.evaluate(() => window.__tilePoint(1));
await page.evaluate((p) => {
  const rig = window.__stage.rig;
  rig.wantYaw = 0;
  rig.wantPitch = 0.62;
  rig.wantRadius = 4.4;
  rig.wantTarget.set(p.x, 0.2, p.z);
  rig.manualUntil = performance.now() + 100000;
}, point);
await page.evaluate(() => window.__stage.rig.whenSettled(3500));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/r7-owner-sign-short.png` });
const state = await page.evaluate(() => ({ cash: document.querySelector('#you-cash')?.textContent }));
writeFileSync(`${OUT}/owner-sign-short.log`, `${JSON.stringify({ state, categories, buttons })}\nerrors=${JSON.stringify(errors.slice(-5))}\n`);
console.log('state', state);
console.log('errors', errors.slice(-5));
await browser.close();
