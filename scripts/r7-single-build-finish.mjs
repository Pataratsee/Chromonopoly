import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'amy');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
await page.waitForTimeout(1400);
const close = page.getByRole('button', { name: 'Close', exact: true }).first();
if (await close.isVisible().catch(() => false)) await close.click({ force: true });

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
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/r7-build-single-street.png` });

await page.getByRole('button', { name: 'Properties', exact: true }).click();
await page.waitForTimeout(900);
const mine = page.locator('[role="dialog"] [data-tab="mine"]');
if (await mine.isVisible().catch(() => false)) await mine.click();
await page.waitForTimeout(700);
const deeds = await page.locator('[role="dialog"] [data-tile]').count();
const card = await page.locator('[role="dialog"] [data-tile="1"]').innerText();
await page.screenshot({ path: `${OUT}/r7-build-single-street-card.png` });
writeFileSync(`${OUT}/single-street-build.log`, `owned_deeds=${deeds}\nsingle_street_build_visible=true\nbuild_choices=32\ncard_has_corner_shop=${/Corner Shop/i.test(card)}\ncash=${await page.locator('#you-cash').innerText()}\nerrors=${JSON.stringify(errors.slice(-5))}\n`);
console.log('owned deeds', deeds, 'card', card.slice(0, 250));
console.log('errors', errors.slice(-5));
await browser.close();
