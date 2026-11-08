import { chromium } from '@playwright/test';
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
await page.waitForTimeout(1800);
const close = page.getByRole('button', { name: 'Close', exact: true }).first();
if (await close.isVisible().catch(() => false)) await close.click({ force: true });
const point = await page.evaluate(() => window.__tilePoint(1));
await page.evaluate((p) => {
  const rig = window.__stage.rig;
  rig.wantYaw = Math.PI;
  rig.wantPitch = 0.55;
  rig.wantRadius = 4.4;
  rig.wantTarget.set(p.x, 0.2, p.z);
  rig.manualUntil = performance.now() + 100000;
}, point);
await page.evaluate(() => window.__stage.rig.whenSettled(3500));
await page.waitForTimeout(1000);
const building = await page.evaluate(() => {
  const root = window.__stage.scene.getObjectByName('buildings');
  return { children: root?.children.length ?? -1, visible: root?.visible ?? null };
});
await page.screenshot({ path: 'docs/round7-proof/r7-build-single-street-model.png' });
console.log(JSON.stringify({ building, errors: errors.slice(-5) }));
await browser.close();
