import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

const contexts: BrowserContext[] = [];
test.describe.configure({ timeout: 150_000, mode: 'serial' });

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  contexts.length = 0;
});

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/test/reset');
  expect(response.ok()).toBe(true);
});

async function join(browser: Browser, name: string, mode: 'solo' | 'multi' = 'multi'): Promise<{ context: BrowserContext; page: Page; session: string }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto('/?e2e');
  await page.locator('#name-input').fill(name);
  await page.locator(mode === 'solo' ? '#solo-btn' : '#multi-btn').click();
  await expect(page.locator('#you-name')).toHaveText(name);
  await page.waitForTimeout(500);
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  expect(session, 'a session must be issued').toBeTruthy();
  return { context, page, session: session! };
}

async function scenario(
  request: APIRequestContext,
  session: string,
  setup: Record<string, unknown>,
  mode: 'solo' | 'multi' = 'multi',
): Promise<void> {
  const response = await request.post('/api/test/scenario', { data: { session, setup, mode } });
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
}

test('solo starts with four equal stacks and only advances after the human acts', async ({ browser, request }) => {
  const { page, session } = await join(browser, 'Solo QA', 'solo');
  await expect(page.locator('.rail-row')).toHaveCount(4);
  const stacks = await page.locator('.rail-cash').allInnerTexts();
  expect(stacks).toHaveLength(4);
  for (const stack of stacks) expect(Number(stack.replace(/[^0-9]/g, ''))).toBe(1500);
  await expect(page.locator('.rail-row.turn .rail-name')).toHaveText('Solo QA');
  await expect(page.locator('#roll-btn')).toBeEnabled();

  // A deterministic offer keeps the human on turn until they resolve it.
  await scenario(request, session, { kind: 'offer', tile: 39 }, 'solo');
  await expect(page.locator('#pending-sheet')).toContainText('Buy Boardwalk');
  await page.getByRole('button', { name: /^Buy / }).click();
  await expect(page.locator('#pending-sheet')).toBeHidden();
  // The bots act immediately and control can be back on the human within 2.5s;
  // prove the turn advanced by observing a bot spend, not by catching the gap.
  await expect
    .poll(async () => {
      const stacks = await page.locator('.rail-cash').allInnerTexts();
      return stacks.slice(1).some((text) => Number(text.replace(/[^0-9]/g, '')) !== 1500);
    }, { timeout: 5000 })
    .toBe(true);
});

test('restart creates a fresh solo table and session', async ({ browser }) => {
  const { page, session } = await join(browser, 'Restart QA', 'solo');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart table' }).click();
  await expect(page.locator('#you-name')).toHaveText('Restart QA', { timeout: 20_000 });
  const next = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  expect(next, 'restart must issue a new session').toBeTruthy();
  expect(next).not.toBe(session);
  await expect(page.locator('.rail-row')).toHaveCount(4);
  const stacks = await page.locator('.rail-cash').allInnerTexts();
  for (const stack of stacks) expect(Number(stack.replace(/[^0-9]/g, ''))).toBe(1500);
});

test('four clients share one public board', async ({ browser }) => {
  const players = await Promise.all([
    join(browser, 'Four A'),
    join(browser, 'Four B'),
    join(browser, 'Four C'),
    join(browser, 'Four D'),
  ]);
  for (const player of players) {
    await expect(player.page.locator('.rail-row')).toHaveCount(4);
    for (const name of ['Four A', 'Four B', 'Four C', 'Four D']) {
      await expect(player.page.locator('.rail')).toContainText(name);
    }
  }
});

test('both card decks draw a visible, readable card', async ({ browser, request }) => {
  const { page, session } = await join(browser, 'Card QA');
  await scenario(request, session, { kind: 'card', deck: 'chance' });
  await expect(page.locator('#card-draw')).toBeVisible();
  await expect(page.locator('#card-draw .card-deck')).toHaveText('Chance');
  await expect(page.locator('#card-draw .card-front p')).not.toBeEmpty();
  // The card dismisses itself after 3.2s; clicking at that boundary races the timer.
  await expect(page.locator('#card-draw')).toBeHidden({ timeout: 5000 });

  await scenario(request, session, { kind: 'card', deck: 'chest' });
  await expect(page.locator('#card-draw')).toBeVisible();
  await expect(page.locator('#card-draw .card-deck')).toHaveText('Community Chest');
  await expect(page.locator('#card-draw .card-front p')).not.toBeEmpty();
});

test('the chance meter shows the server odds, roll and outcome to the actor only', async ({ browser, request }) => {
  const actor = await join(browser, 'Meter Actor');
  const owner = await join(browser, 'Meter Owner');
  await scenario(request, actor.session, {
    kind: 'rent',
    tile: 39,
    ownerSession: owner.session,
    cash: 2000,
    roll: 0.99,
  });

  const ownerBanner = await owner.page.locator('#ribbon').innerText();
  await actor.page.getByRole('button', { name: 'Try to evade' }).click();
  const meter = actor.page.locator('#chance-overlay');
  await expect(meter).toBeVisible();
  await expect(meter).toHaveAttribute('data-chance', '60');
  await expect(meter.locator('.chance-face b')).toHaveText('60%');
  await expect(meter.locator('.chance-result')).toHaveText('Spin to reveal');
  const before = await meter.locator('.chance-pointer').evaluate((el) => (el as HTMLElement).style.transform);
  expect(before).toContain('rotate(0deg)');
  await meter.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(meter.locator('.chance-continue')).toBeVisible({ timeout: 4000 });
  await expect(meter.locator('.chance-result')).toHaveText('Caught');
  const transform = await meter.locator('.chance-pointer').evaluate((el) => (el as HTMLElement).style.transform);
  expect(transform).toContain('356.4');
  await expect(owner.page.locator('#ribbon')).toHaveText(ownerBanner, { ignoreCase: true });
  await expect(owner.page.locator('#chance-overlay')).toHaveCount(0);
  await meter.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(meter).toHaveCount(0);
});

test('murder requires an explicit warning and can be cancelled', async ({ browser }) => {
  const actor = await join(browser, 'Murder Actor');
  await join(browser, 'Murder Target');
  await actor.page.getByRole('button', { name: 'Underworld', exact: true }).click();
  const row = actor.page.getByRole('dialog').locator('.row').filter({ hasText: 'Murder Target' });
  await row.getByRole('button', { name: 'Murder' }).click();
  await expect(actor.page.locator('.warning-banner')).toContainText('erase a player');
  await expect(actor.page.getByRole('dialog')).toContainText('Success chance');
  await expect(actor.page.getByRole('dialog')).toContainText('1%');
  await actor.page.getByRole('button', { name: 'Cancel' }).click();
  await expect(actor.page.getByRole('dialog')).toBeHidden();
});
