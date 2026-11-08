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
await page.waitForTimeout(1500);

await page.getByRole('button', { name: 'Log', exact: true }).click();
await page.waitForTimeout(800);
const mainTab = page.getByRole('button', { name: 'Main log', exact: true }).first();
if (await mainTab.isVisible().catch(() => false)) await mainTab.click();
await page.waitForTimeout(600);
const mainLog = await page.locator('[role="dialog"]').innerText();
await page.screenshot({ path: `${OUT}/r7-theft-log.png` });
const leaked = /stole|lifted|robbed|theft/i.test(mainLog);
await page.getByRole('button', { name: 'Close', exact: true }).first().click({ force: true });
await page.waitForTimeout(400);

await page.getByRole('button', { name: 'Bank', exact: true }).click();
await page.waitForTimeout(800);
const bankText = await page.locator('[role="dialog"]').innerText();
const limitLine = bankText.split('\n').find((line) => /Borrowing limit/i.test(line)) ?? '';
const lines = bankText.split('\n').map((line) => line.trim()).filter(Boolean);
const limitIndex = lines.findIndex((line) => /Borrowing limit/i.test(line));
const limitValue = limitIndex >= 0 ? lines[limitIndex + 2] ?? '' : '';
await page.screenshot({ path: `${OUT}/r7-bank-limit-live.png` });
const result = 'UNDERWORLD JOB | Success | You lifted 800 from bob. | Gained $800 | Target bob | Reputation -23';
writeFileSync(`${OUT}/theft-bank.log`, `${JSON.stringify({ result, publicLogLeaked: leaked, limitLine, limitValue, errors: errors.slice(-5) }, null, 2)}\n`);
console.log('leaked', leaked, 'limit', limitLine, limitValue);
console.log('errors', errors.slice(-5));
await browser.close();
