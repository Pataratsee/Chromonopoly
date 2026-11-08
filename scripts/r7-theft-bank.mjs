import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = 'docs/round7-proof';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const close = async () => {
  const button = page.getByRole('button', { name: 'Close', exact: true }).first();
  if (await button.isVisible().catch(() => false)) await button.click({ force: true });
  await page.waitForTimeout(250);
};

await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'amy');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
await page.waitForTimeout(1200);
await close();

const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
const setup = await fetch(`${BASE}/api/test/scenario`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ session, mode: 'multi', setup: { kind: 'theft', cash: 5000, roll: 0.01 } }),
});
console.log('theft setup', setup.status, await setup.text());
await page.waitForTimeout(500);

await page.getByRole('button', { name: 'Underworld', exact: true }).click();
await page.waitForTimeout(800);
const targetRow = page.locator('[role="dialog"] .row').filter({ hasText: 'bob' }).first();
const rob = targetRow.getByRole('button', { name: 'Rob', exact: true });
console.log('rob visible', await rob.isVisible().catch(() => false));
await rob.click();
await page.waitForSelector('#crime-result', { state: 'visible', timeout: 12000 });
const result = await page.locator('#crime-result').innerText();
await page.screenshot({ path: `${OUT}/r7-theft-success.png` });
console.log('result', result.replace(/\n/g, ' | '));
await page.getByRole('button', { name: 'Continue', exact: true }).click();
await page.waitForTimeout(500);

await page.getByRole('button', { name: 'Log', exact: true }).click();
await page.waitForTimeout(700);
const mainTab = page.getByRole('button', { name: 'Main log', exact: true }).first();
if (await mainTab.isVisible().catch(() => false)) await mainTab.click();
await page.waitForTimeout(500);
const mainLog = await page.locator('[role="dialog"]').innerText();
await page.screenshot({ path: `${OUT}/r7-theft-log.png` });
const leaked = /stole|lifted|robbed|theft/i.test(mainLog);
console.log('public log leaked', leaked);
await page.getByRole('button', { name: 'Close', exact: true }).first().click({ force: true });
await page.waitForTimeout(300);

await page.getByRole('button', { name: 'Bank', exact: true }).click();
await page.waitForTimeout(700);
const bankText = await page.locator('[role="dialog"]').innerText();
const limitLine = bankText.split('\n').find((line) => /Borrowing limit/i.test(line)) ?? '';
const limitValue = bankText.split('\n').find((line) => /^\$/.test(line.trim()) && /Borrowing limit/i.test(bankText)) ?? '';
await page.screenshot({ path: `${OUT}/r7-bank-limit-live.png` });
const data = { result: result.replace(/\n/g, ' | '), publicLogLeaked: leaked, limitLine, limitValue, errors: errors.slice(-5) };
writeFileSync(`${OUT}/theft-bank.log`, `${JSON.stringify(data, null, 2)}\n`);
console.log('limit', limitLine, limitValue);
console.log('errors', errors.slice(-5));
await browser.close();
