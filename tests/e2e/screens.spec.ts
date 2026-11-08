import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const sizes = [
  { width: 1280, height: 720, name: '1280x720' },
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 2560, height: 1440, name: '2560x1440' },
  { width: 2560, height: 1080, name: '21x9' },
];

async function session(page: Page): Promise<string> {
  const value = await page.evaluate(() => localStorage.getItem('chromonopoly.session'));
  expect(value).toBeTruthy();
  return value!;
}

async function scenario(request: APIRequestContext, page: Page, setup: Record<string, unknown>): Promise<void> {
  const response = await request.post('/api/test/scenario', { data: { session: await session(page), setup } });
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  await page.waitForTimeout(400);
}

async function join(page: Page, name: string): Promise<void> {
  await page.goto('/?e2e&visual=1');
  await page.locator('#name-input').fill(name);
  await page.locator('#multi-btn').click();
  await expect(page.locator('#you-name')).toHaveText(name);
  await page.waitForTimeout(700);
}

async function resolveChance(page: Page): Promise<void> {
  const meter = page.locator('#chance-overlay');
  const appeared = await meter.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false);
  if (!appeared) return;
  await meter.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(meter.locator('.chance-continue')).toBeVisible({ timeout: 5000 });
  await meter.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(meter).toHaveCount(0);
}

async function captureFour(page: Page, screen: string): Promise<void> {
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(550);
    await page.screenshot({ path: `screenshots/${screen}-${size.name}.png` });
  }
}

test('captures settings and underworld panels in light and dark at three UI scales', async ({ browser, request }) => {
  test.setTimeout(300_000);
  const reset = await request.post('/api/test/reset');
  expect(reset.ok()).toBe(true);

  for (const theme of ['light', 'dark'] as const) {
    for (const scale of [0.8, 1, 1.3]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(
        ({ darkMode, uiScale }) => {
          localStorage.setItem('chromonopoly.settings', JSON.stringify({ darkMode, uiScale }));
        },
        { darkMode: theme === 'dark', uiScale: scale },
      );
      const page = await context.newPage();
      const label = `Scale ${theme} ${scale}`;
    await page.goto('/?e2e&visual=1');
      await page.locator('#name-input').fill(label);
      await page.locator('#multi-btn').click();
      await expect(page.locator('#you-name')).toHaveText(label);
      await page.waitForTimeout(900);

      for (const panel of ['Settings', 'Underworld']) {
        await page.getByRole('button', { name: panel, exact: true }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.waitForTimeout(350);
        await page.screenshot({
          path: `screenshots/panel-${panel.toLowerCase()}-${theme}-${Math.round(scale * 100)}.png`,
        });
        await page.getByRole('button', { name: 'Close' }).click();
        await page.waitForTimeout(250);
      }
      await context.close();
    }
  }
});

test('captures tile, rent, build, jail and endgame screens at four resolutions', async ({ browser, request }) => {
  test.setTimeout(600_000);
  const reset = await request.post('/api/test/reset');
  expect(reset.ok()).toBe(true);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await join(page, 'Screen Actor');

  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const owner = await ownerContext.newPage();
  await join(owner, 'Screen Owner');
  const ownerSession = await session(owner);

  await scenario(request, page, { kind: 'build', tile: 39, cash: 5000 });
  await page.waitForTimeout(500);
  const point = await page.evaluate(() => window.__tileScreen!(39));
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('dialog')).toContainText('Boardwalk');
  await captureFour(page, 'tile-card');

  await page.getByRole('button', { name: 'Build here' }).click();
  await expect(page.getByRole('dialog')).toContainText('Build on Boardwalk');
  await captureFour(page, 'build-menu');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(250);

  await scenario(request, page, {
    kind: 'rent',
    tile: 39,
    ownerSession,
    building: 'house',
    cash: 2000,
    roll: 0.99,
  });
  await expect(page.locator('#pending-sheet')).toContainText('Rent due at Boardwalk');
  await captureFour(page, 'rent-dialog');
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page.locator('#pending-sheet')).toBeHidden();

  await scenario(request, page, { kind: 'jail', tile: 37, cash: 5000 });
  await expect(page.locator('#jail-card')).toBeVisible();
  await resolveChance(page);
  await page.getByRole('button', { name: 'Public record' }).click();
  await expect(page.getByRole('dialog')).toContainText("Screen Actor's record");
  await captureFour(page, 'jail-record');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(250);

  await scenario(request, page, { kind: 'endgame' });
  await expect(page.getByRole('dialog')).toContainText('Game over');
  await captureFour(page, 'endgame');

  await context.close();
  await ownerContext.close();
});
