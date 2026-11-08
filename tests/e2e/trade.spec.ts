import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

const contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  contexts.length = 0;
});

async function join(browser: Browser, name: string): Promise<{ page: Page; session: string }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto('/?e2e');
  await page.locator('#name-input').fill(name);
  await page.locator('#multi-btn').click();
  await expect(page.locator('#you-name')).toHaveText(name);
  await page.waitForTimeout(500);
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  expect(session).toBeTruthy();
  return { page, session: session! };
}

async function scenario(request: APIRequestContext, session: string, setup: Record<string, unknown>): Promise<void> {
  const response = await request.post('/api/test/scenario', { data: { session, setup } });
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
}

async function cash(page: Page, name: string): Promise<number> {
  const text = await page.locator('.rail-row').filter({ hasText: name }).locator('.rail-cash').innerText();
  return Number(text.replace(/[^0-9-]/g, ''));
}

test('two real clients complete a cash-for-property trade atomically', async ({ browser, request }) => {
  test.setTimeout(240_000);
  const reset = await request.post('/api/test/reset');
  expect(reset.ok()).toBe(true);
  const a = await join(browser, 'Trade A');
  const b = await join(browser, 'Trade B');

  await scenario(request, a.session, { kind: 'rent', tile: 39, ownerSession: b.session, cash: 2000, roll: 0.99 });
  await expect(a.page.locator('#pending-sheet')).toContainText('Rent due at Boardwalk');
  await a.page.getByRole('button', { name: /^Pay / }).click();
  await expect(a.page.locator('#pending-sheet')).toBeHidden();
  const bBefore = await cash(b.page, 'Trade B');

  await a.page.getByRole('button', { name: 'Properties', exact: true }).click();
  await a.page.getByRole('button', { name: 'Trade' }).click();
  await a.page.locator('.trade-target select').selectOption({ label: 'Trade B' });
  await a.page.locator('.trade-side').nth(0).locator('input[type=number]').fill('200');
  await a.page.locator('.trade-side').nth(1).locator('label').filter({ hasText: 'Boardwalk' }).locator('input').check();
  await a.page.screenshot({ path: 'screenshots/rev4-trade-offer.png' });
  await a.page.getByRole('button', { name: 'Send offer' }).click();
  await a.page.waitForTimeout(800);

  await b.page.getByRole('button', { name: 'Properties', exact: true }).click();
  await b.page.getByRole('button', { name: 'Trade' }).click();
  const incoming = b.page.locator('.sheet');
  await expect(incoming).toContainText('Trade A');
  await expect(incoming).toContainText('Boardwalk');
  await expect(incoming).toContainText('200');
  await b.page.screenshot({ path: 'screenshots/rev4-trade-incoming.png' });
  await b.page.getByRole('button', { name: 'Accept', exact: true }).click();
  await b.page.waitForTimeout(900);
  await b.page.screenshot({ path: 'screenshots/rev4-trade-accepted.png' });
  expect(await cash(b.page, 'Trade B')).toBe(bBefore + 200);

  await b.page.getByRole('button', { name: 'Close' }).click();
  await b.page.getByRole('button', { name: 'Properties', exact: true }).click();
  const bMine = b.page.locator('.sheet');
  await expect(bMine).not.toContainText('Boardwalk');

  const aClose = a.page.getByRole('button', { name: 'Close' });
  if (await aClose.isVisible().catch(() => false)) await aClose.click();
  await a.page.getByRole('button', { name: 'Properties', exact: true }).click();
  await expect(a.page.locator('.sheet')).toContainText('Boardwalk');
  await a.page.screenshot({ path: 'screenshots/rev4-trade-my-properties.png' });
});