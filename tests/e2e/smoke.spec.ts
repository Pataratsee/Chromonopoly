import { expect, test, type Page } from '@playwright/test';

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function join(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.locator('#name-input').fill(name);
  await page.locator('#multi-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();
  await expect(page.locator('#you-name')).toHaveText(name);
  await page.waitForTimeout(1200);
}

test('joins one shared board, rolls, and opens every panel without console errors', async ({ page }) => {
  const errors = watchConsole(page);
  await join(page, 'Playwright QA');

  for (const label of ['Settings', 'Pieces', 'Market', 'Bank', 'Underworld', 'Court']) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(220);
  }

  await page.locator('#roll-btn').click();
  await page.waitForTimeout(1400);

  // GL driver perf messages are emitted by headless Chromium, not the app.
  const errorsAfter = errors.filter((e) => !e.includes('favicon') && !e.includes('GL Driver Message'));
  expect(errorsAfter).toEqual([]);
});

test('two clients share the same world', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  await join(a, 'Client A');
  await join(b, 'Client B');

  await expect(a.locator('.rail-row')).toContainText(['Client A', 'Client B']);
  await expect(b.locator('.rail-row')).toContainText(['Client A', 'Client B']);
  await contextA.close();
  await contextB.close();
});

test('captures every main panel', async ({ browser }) => {
  test.setTimeout(180_000);
  const panels: Array<[string, string, string]> = [
    ['Pieces', 'panel-pieces', 'Piece QA'],
    ['Settings', 'panel-settings', 'Settings QA'],
    ['Market', 'panel-market', 'Market QA'],
    ['Bank', 'panel-bank', 'Bank QA'],
    ['Underworld', 'panel-underworld', 'Underworld QA'],
    ['Court', 'panel-court', 'Court QA'],
  ];
  for (const [label, file, name] of panels) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await join(page, name);
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `screenshots/${file}.png` });
    await page.close();
  }
});

test('captures the board at the four required resolutions', async ({ page }) => {
  await join(page, 'Screenshot QA');
  const sizes = [
    { width: 1280, height: 720, name: '1280x720' },
    { width: 1920, height: 1080, name: '1920x1080' },
    { width: 2560, height: 1440, name: '2560x1440' },
    { width: 2560, height: 1080, name: '21x9' },
  ];
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `screenshots/board-${size.name}.png` });
  }
});
