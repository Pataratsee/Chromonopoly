import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'round7_mw86itaa');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
try {
  await page.waitForSelector('#you-name', { state: 'visible', timeout: 20000 });
  console.log('LOGIN_OK', await page.locator('#you-name').innerText());
} catch (e) {
  console.log('LOGIN_FAILED', await page.locator('.auth-error').innerText().catch(() => 'no error text'));
  console.log('BODY', (await page.locator('body').innerText()).slice(0, 500));
}
await page.waitForTimeout(1500);
await page.screenshot({ path: 'docs/round7-proof/r7-board-entry.png' });
console.log('TITLE', await page.title());
console.log('URL', page.url());
console.log('ERRORS', JSON.stringify(errors.slice(-12), null, 1));
console.log('BUTTONS', JSON.stringify(await page.locator('button').allInnerTexts()));
writeFileSync('/tmp/r7-ui-body.txt', await page.locator('body').innerText());
await browser.close();
