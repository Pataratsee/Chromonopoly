import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

interface TestPlayer {
  context: BrowserContext;
  page: Page;
  session: string;
}

const contexts: BrowserContext[] = [];
test.describe.configure({ timeout: 240_000, mode: 'serial' });

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  contexts.length = 0;
});

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/test/reset');
  expect(response.ok()).toBe(true);
});

async function newPlayer(browser: Browser, name: string, mode: 'solo' | 'multi' = 'multi'): Promise<TestPlayer> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto('/?e2e');
  await page.locator('#name-input').fill(name);
  await page.locator(mode === 'solo' ? '#solo-btn' : '#multi-btn').click();
  await expect(page.locator('#you-name')).toHaveText(name);
  await page.waitForTimeout(500);
  const session = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  expect(session, 'the server must issue a session').toBeTruthy();
  return { context, page, session: session! };
}

async function scenario(
  request: APIRequestContext,
  player: TestPlayer,
  setup: Record<string, unknown>,
): Promise<void> {
  const response = await request.post('/api/test/scenario', { data: { session: player.session, setup } });
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  await player.page.waitForTimeout(350);
}

async function cash(page: Page): Promise<number> {
  const text = await page.locator('#you-cash').innerText();
  return Number(text.replace(/[^0-9-]/g, ''));
}

async function closeSheet(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Close' });
  if (await close.isVisible().catch(() => false)) await close.click();
  await page.waitForTimeout(250);
}

async function openSheet(page: Page, button: string): Promise<void> {
  await page.getByRole('button', { name: button, exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function resolveChance(page: Page): Promise<void> {
  const meter = page.locator('#chance-overlay');
  const appeared = await meter.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
  if (!appeared) return;
  // A failed job can queue a jail-sale wheel behind the job wheel.
  for (let n = 0; n < 4; n++) {
    await expect(meter).toBeVisible({ timeout: n === 0 ? 1500 : 5000 });
    await meter.getByRole('button', { name: 'Spin', exact: true }).click();
    await expect(meter.locator('.chance-continue')).toBeVisible({ timeout: 5000 });
    await meter.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForTimeout(350);
    if (!(await meter.isVisible().catch(() => false))) {
      await page.waitForTimeout(350);
      if (!(await meter.isVisible().catch(() => false))) return;
    }
  }
  await expect(meter).toHaveCount(0);
}

test('rent evasion: success adds a public unpaid-rent record and pays nothing', async ({ browser, request }) => {
  const actor = await newPlayer(browser, 'Evade Lucky');
  const owner = await newPlayer(browser, 'Evade Owner');
  await scenario(request, actor, {
    kind: 'rent',
    tile: 39,
    ownerSession: owner.session,
    building: 'house',
    cash: 2000,
    roll: 0,
  });

  await expect(actor.page.locator('#pending-sheet')).toContainText('Rent due at Boardwalk');
  // The scenario is acknowledged before the next public/private frame reaches
  // the browser and the cash counter animates; allow for a loaded CI browser.
  await expect.poll(() => cash(actor.page), { timeout: 15_000 }).toBe(2000);
  const before = await cash(actor.page);
  await actor.page.getByRole('button', { name: 'Try to evade' }).click();
  await resolveChance(actor.page);
  await expect(actor.page.locator('#pending-sheet')).toBeHidden();
  await expect.poll(() => cash(actor.page), { timeout: 10_000 }).toBe(before);

  await openSheet(actor.page, 'Court');
  const dialog = actor.page.getByRole('dialog');
  await expect(dialog).toContainText('Your public record');
  await expect(dialog).toContainText('Boardwalk');
});

test('rent evasion: caught succeeds in charging the penalty and logs it', async ({ browser, request }) => {
  const actor = await newPlayer(browser, 'Evade Caught');
  const owner = await newPlayer(browser, 'Caught Owner');
  await scenario(request, actor, {
    kind: 'rent',
    tile: 39,
    ownerSession: owner.session,
    building: 'house',
    cash: 2000,
    roll: 0.99,
  });

  // The scenario is acknowledged before the next public state frame reaches
  // the browser; read the settled stack, not the pre-scenario placeholder.
  await expect.poll(() => cash(actor.page), { timeout: 15_000 }).toBe(2000);
  const before = await cash(actor.page);
  await actor.page.getByRole('button', { name: 'Try to evade' }).click();
  await resolveChance(actor.page);
  await expect(actor.page.locator('#pending-sheet')).toBeHidden();
  await expect.poll(() => cash(actor.page), { timeout: 10_000 }).toBeLessThan(before);

  await openSheet(actor.page, 'Log');
  await expect(actor.page.getByRole('dialog')).toContainText('caught evading');
});

test('jail: paying release clears the badge and restores rolling', async ({ browser, request }) => {
  const actor = await newPlayer(browser, 'Jail Release');
  await scenario(request, actor, { kind: 'jail', tile: 37, cash: 5000 });
  await resolveChance(actor.page);

  await expect(actor.page.locator('#jail-card')).toContainText('In jail');
  await expect(actor.page.locator('#roll-btn')).toHaveText('SERVE');
  await expect.poll(() => cash(actor.page), { timeout: 15_000 }).toBe(5000);
  const before = await cash(actor.page);
  await actor.page.getByRole('button', { name: 'Public record' }).click();
  await expect(actor.page.getByRole('dialog')).toContainText('Public jail ledger');
  await expect(actor.page.getByRole('dialog')).toContainText('Park Place');
  await closeSheet(actor.page);

  await actor.page.getByRole('button', { name: 'Pay release' }).click();
  await resolveChance(actor.page);
  await expect(actor.page.locator('#jail-card')).toBeHidden();
  await expect(actor.page.locator('#roll-btn')).toHaveText('ROLL');
  // All-sold can leave nothing to unmortgage, so release can legitimately be free.
  await expect.poll(() => cash(actor.page), { timeout: 10_000 }).toBeLessThanOrEqual(before);
});

test('detective: a successful investigation produces usable evidence', async ({ browser, request }) => {
  const actor = await newPlayer(browser, 'Detective Client');
  const target = await newPlayer(browser, 'Detective Target');
  await scenario(request, actor, {
    kind: 'evidence',
    targetSession: target.session,
    tile: 39,
    cash: 12_000,
    roll: 0,
  });

  await openSheet(actor.page, 'Underworld');
  const row = actor.page.getByRole('dialog').locator('.row').filter({ hasText: 'Detective Target' });
  await row.getByRole('button', { name: /Detective/ }).click();
  await resolveChance(actor.page);
  await closeSheet(actor.page);

  await openSheet(actor.page, 'Court');
  const court = actor.page.getByRole('dialog');
  const targetRow = court.locator('.group').filter({ hasText: 'Detective Target' });
  await expect(targetRow).toContainText('Evidence strength');
  await expect(targetRow).not.toContainText('No evidence');
  await expect(targetRow.getByRole('button', { name: 'Sue' })).toBeEnabled();
});

test('settlement: the defendant can settle an open case for 1.5x the claim', async ({ browser, request }) => {
  const plaintiff = await newPlayer(browser, 'Settle Plaintiff');
  const defendant = await newPlayer(browser, 'Settle Defendant');
  await scenario(request, plaintiff, {
    kind: 'suit',
    targetSession: defendant.session,
    claim: 500,
    cash: 3000,
  });
  await scenario(request, defendant, { kind: 'cash', cash: 3000 });

  await openSheet(defendant.page, 'Court');
  const caseRow = defendant.page.getByRole('dialog').locator('.group').filter({ hasText: 'Settle Plaintiff v. Settle Defendant' });
  await expect(caseRow).toContainText('Claim $500');
  await caseRow.getByRole('button', { name: 'Settle $750' }).click();
  await closeSheet(defendant.page);
  await expect.poll(() => cash(defendant.page), { timeout: 15_000 }).toBe(2250);

  await defendant.page.locator('button[aria-label="Log"]').click();
  await expect(defendant.page.getByRole('dialog')).toContainText('settles with');
});

test('court: a winning verdict pays the claim and fees', async ({ browser, request }) => {
  const plaintiff = await newPlayer(browser, 'Court Winner');
  const defendant = await newPlayer(browser, 'Court Defendant');
  await scenario(request, plaintiff, {
    kind: 'suit',
    targetSession: defendant.session,
    claim: 500,
    cash: 3000,
    roll: 0,
  });
  await scenario(request, defendant, { kind: 'cash', cash: 3000 });

  await openSheet(plaintiff.page, 'Court');
  await plaintiff.page.getByRole('button', { name: 'Call the verdict' }).click();
  await resolveChance(plaintiff.page);
  await closeSheet(plaintiff.page);
  await expect.poll(() => cash(plaintiff.page), { timeout: 15_000 }).toBe(3700);
  await plaintiff.page.locator('button[aria-label="Log"]').click();
  await expect(plaintiff.page.getByRole('dialog')).toContainText('Verdict: Court Winner wins 700');
});

test('court: a losing verdict costs the plaintiff', async ({ browser, request }) => {
  const losingPlaintiff = await newPlayer(browser, 'Court Loser');
  const losingDefendant = await newPlayer(browser, 'Loss Defendant');
  await scenario(request, losingPlaintiff, {
    kind: 'suit',
    targetSession: losingDefendant.session,
    claim: 500,
    cash: 3000,
    roll: 0.99,
  });
  await losingPlaintiff.page.waitForTimeout(300);
  await openSheet(losingPlaintiff.page, 'Court');
  await losingPlaintiff.page.getByRole('button', { name: 'Call the verdict' }).click();
  await resolveChance(losingPlaintiff.page);
  await closeSheet(losingPlaintiff.page);
  await expect.poll(() => cash(losingPlaintiff.page), { timeout: 15_000 }).toBe(2850);
  await losingPlaintiff.page.locator('button[aria-label="Log"]').click();
  await expect(losingPlaintiff.page.getByRole('dialog')).toContainText('Verdict: Court Loser loses and pays 150');
});

test('theft: a successful bank job pays, a failed job jails the thief', async ({ browser, request }) => {
  const actor = await newPlayer(browser, 'Theft Runner');
  await scenario(request, actor, { kind: 'theft', cash: 1500, reputation: 50, roll: 0 });

  await openSheet(actor.page, 'Underworld');
  await actor.page.getByRole('button', { name: 'Rob', exact: true }).first().click();
  await resolveChance(actor.page);
  await closeSheet(actor.page);
  await expect.poll(() => cash(actor.page), { timeout: 15_000 }).toBeGreaterThan(1500);

  await scenario(request, actor, { kind: 'theft', cash: 1500, reputation: 50, roll: 0.99 });
  await openSheet(actor.page, 'Underworld');
  await actor.page.getByRole('button', { name: 'Rob', exact: true }).first().click();
  await resolveChance(actor.page);
  await closeSheet(actor.page);
  await expect(actor.page.locator('#jail-card')).toContainText('In jail');
  expect(await cash(actor.page)).toBeLessThanOrEqual(1500);
});
