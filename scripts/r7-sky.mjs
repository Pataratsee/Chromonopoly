import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
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
for (const preset of ['Sunrise', 'Noon', 'Sunset', 'Night']) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(350);
  if (preset === 'Sunrise') {
    const reduced = page.getByRole('switch', { name: 'Reduced motion' });
    if (await reduced.getAttribute('aria-checked') !== 'true') await reduced.click();
  }
  await page.getByRole('button', { name: preset, exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/round7-proof/r7-sky-${preset.toLowerCase()}.png` });
  console.log('captured', preset, await page.evaluate(() => window.__sky?.update(0)));
}
await browser.close();
