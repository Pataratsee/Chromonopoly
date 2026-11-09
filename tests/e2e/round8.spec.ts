import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Round 8 end-to-end proof. Every scenario drives the real UI against the real
 * server built by playwright.config.ts (fresh database per run).
 */

const PASSWORD = 'Round8!test';
const contexts: BrowserContext[] = [];
test.describe.configure({ timeout: 240_000, mode: 'serial' });

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  contexts.length = 0;
});

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // The negative auth tests deliberately provoke these statuses.
    if (/Failed to load resource: the server responded with a status of (401|409)/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('favicon')) return;
    // Reloads and closed menus abort in-flight polls and blob URLs.
    if ((req.failure()?.errorText ?? '').includes('ERR_ABORTED')) return;
    errors.push(`requestfailed: ${req.method()} ${url} ${req.failure()?.errorText ?? ''}`);
  });
  return errors;
}

async function newContext(browser: Browser, viewport = { width: 1280, height: 720 }): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport });
  contexts.push(context);
  return context;
}

function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.slice(0, 16);
}

async function openAuth(page: Page): Promise<void> {
  await page.goto('/?e2e');
  await expect(page.locator('#multi-btn')).toBeVisible();
  await page.locator('#multi-btn').click();
  await expect(page.locator('#auth-username')).toBeVisible();
}

async function createAccount(page: Page, username: string): Promise<void> {
  await openAuth(page);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  await expect(page.locator('#you-name')).toHaveText(username);
}

async function login(page: Page, username: string, password = PASSWORD): Promise<void> {
  await openAuth(page);
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-submit').click();
}

async function logout(page: Page): Promise<void> {
  await page.locator('#dock button[aria-label="Settings"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#logout-btn').click();
  // Logging out lands on the sign-in panel, never inside the game.
  await expect(page.locator('#auth-username')).toBeVisible();
  await expect(page.locator('#hud')).toHaveClass(/hidden/);
}

test('V1/V12: menu, validation, create, login, refresh, logout, duplicate, wrong password', async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  const errors = watchConsole(page);
  await page.goto('/?e2e');

  // V12: the main menu carries no account UI and exactly the four entry points.
  await expect(page.locator('.menu')).toBeVisible();
  await expect(page.locator('#auth-username')).toHaveCount(0);
  await expect(page.locator('#auth-password')).toHaveCount(0);
  await expect(page.locator('#solo-btn')).toBeVisible();
  await expect(page.locator('#multi-btn')).toBeVisible();
  await expect(page.locator('.menu').getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('.menu').getByRole('button', { name: 'How to play', exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/round8-proof/v12-menu-1280x720.png' });

  // V1: account UI appears only after Multiplayer.
  await page.locator('#multi-btn').click();
  await expect(page.locator('#auth-username')).toBeVisible();
  await page.screenshot({ path: 'docs/round8-proof/v1-auth-panel.png' });

  // Empty fields.
  await page.locator('#auth-submit').click();
  await expect(page.locator('.auth-error')).toContainText('Enter a username');

  // Invalid username.
  await page.locator('#auth-username').fill('ab');
  await page.locator('#auth-submit').click();
  await expect(page.locator('.auth-error')).toContainText('3–16');

  // Empty then short password.
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const username = uniqueName('r8');
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-submit').click();
  await expect(page.locator('.auth-error')).toContainText('Enter a password');
  await page.locator('#auth-password').fill('123');
  await page.locator('#auth-submit').click();
  await expect(page.locator('.auth-error')).toContainText('at least 6');

  // Enter submits.
  await page.locator('#auth-password').fill(PASSWORD);
  await page.locator('#auth-password').press('Enter');
  await expect(page.locator('#you-name')).toHaveText(username);
  await expect(page.locator('#roll-btn')).toBeVisible();
  await page.screenshot({ path: 'docs/round8-proof/v1-logged-in.png' });

  // V1: refresh keeps the session; Multiplayer restores without a login form.
  await page.reload();
  await expect(page.locator('#multi-btn')).toBeVisible();
  await page.locator('#multi-btn').click();
  await expect(page.locator('#you-name')).toHaveText(username);
  await expect(page.locator('#auth-username')).toHaveCount(0);

  // V1: logout revokes the session and returns to the sign-in panel.
  await logout(page);

  // Wrong password.
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill('wrongpass');
  await page.locator('#auth-submit').click();
  await expect(page.locator('.auth-error')).toContainText('Wrong username or password');

  // Duplicate username on create.
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  await expect(page.locator('.auth-error')).toContainText('already taken');

  // Log back in.
  await page.getByRole('button', { name: 'Log in', exact: true }).first().click();
  await page.locator('#auth-password').fill(PASSWORD);
  await page.locator('#auth-submit').click();
  await expect(page.locator('#you-name')).toHaveText(username);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('V1: the same account on a second client kicks the first with a clear message', async ({ browser }) => {
  const username = uniqueName('kick');
  const firstContext = await newContext(browser);
  const first = await firstContext.newPage();
  await createAccount(first, username);

  const secondContext = await newContext(browser);
  const second = await secondContext.newPage();
  await login(second, username);
  await expect(second.locator('#you-name')).toHaveText(username);

  // The first client is sent back to the sign-in panel with the reason shown.
  await expect(first.locator('.menu')).toBeVisible({ timeout: 15_000 });
  await expect(first.locator('#auth-username')).toBeVisible();
  await expect(first.locator('#hud')).toHaveClass(/hidden/);
  await expect(first.locator('.auth-error')).toContainText(/another device/i);
  await first.screenshot({ path: 'docs/round8-proof/v1-second-login-kick.png' });
});

test('V2: new solo game saves, refresh restores the exact table, Continue resumes it', async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  await page.goto('/?e2e');
  await page.locator('#solo-btn').click();
  await expect(page.locator('#new-game-btn')).toBeVisible();
  await page.screenshot({ path: 'docs/round8-proof/v2-solo-choice.png' });
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();
  await expect(page.locator('#you-name')).toHaveText('Tycoon');

  const before = await page.evaluate(() => {
    const state = (window as unknown as { __state: () => any }).__state();
    const me = Object.values(state.players).find((p: any) => !p.isBot) as any;
    return {
      cash: me.cash,
      position: me.position,
      turn: state.turnNumber,
      playerId: me.id,
    };
  });

  // Take a turn, then let the server autosave.
  await page.locator('#roll-btn').click();
  await page.waitForTimeout(3500);
  await page.reload();
  await page.locator('#solo-btn').click();
  await expect(page.locator('#continue-btn')).toBeEnabled();
  await page.screenshot({ path: 'docs/round8-proof/v2-continue-enabled.png' });
  await page.locator('#continue-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();

  const after = await page.evaluate(() => {
    const state = (window as unknown as { __state: () => any }).__state();
    const me = Object.values(state.players).find((p: any) => !p.isBot) as any;
    return { cash: me.cash, position: me.position, turn: state.turnNumber, playerId: me.id };
  });
  expect(after.playerId).toBe(before.playerId);
  expect(after.cash).toBeGreaterThanOrEqual(before.cash);
  expect(after.turn).toBeGreaterThanOrEqual(before.turn);
});

test('V12: the piece preview fills a large, square-ish area at every viewport', async ({ browser }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 700, height: 1000 },
  ]) {
    const context = await newContext(browser, viewport);
    const page = await context.newPage();
    await page.goto('/?e2e');
    await expect(page.locator('#menu-preview')).toBeVisible();
    const box = await page.locator('#menu-preview').boundingBox();
    expect(box, `preview missing at ${viewport.width}x${viewport.height}`).not.toBeNull();
    expect(box!.width / viewport.width, 'preview too narrow').toBeGreaterThan(0.3);
    expect(box!.height).toBeGreaterThan(300);
    expect(box!.width / box!.height, 'preview is not squished').toBeGreaterThan(0.7);
    await page.screenshot({ path: `docs/round8-proof/v12-preview-${viewport.width}x${viewport.height}.png` });
    await context.close();
  }
});

test('V3/V11: every panel opens against the live server with no console or network errors', async ({ browser }) => {
  const context = await newContext(browser, { width: 1920, height: 1080 });
  const page = await context.newPage();
  const errors = watchConsole(page);
  await page.goto('/?e2e');
  await page.locator('#solo-btn').click();
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();

  for (const label of ['Market', 'Bank', 'Underworld', 'Detective', 'Properties', 'Reputation', 'Settings', 'Court', 'Log', 'Pieces']) {
    const button = page.locator('#dock button').filter({ hasText: label });
    if ((await button.count()) === 0) continue;
    await button.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    if (label === 'Market') await page.screenshot({ path: 'docs/round8-proof/v3-market-open.png' });
    if (label === 'Log') await page.screenshot({ path: 'docs/round8-proof/v11-player-logs.png' });
    if (label === 'Pieces') {
      await expect(page.locator('.token-card')).toHaveCount(100);
      await page.screenshot({ path: 'docs/round8-proof/v6-100-pieces.png' });
    }
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.waitForTimeout(200);
  }

  expect(errors, errors.join('\n')).toEqual([]);
});

test('V14: six full arrangements shuffle without an immediate repeat', async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  const errors = watchConsole(page);
  await page.goto('/?e2e');
  await page.locator('#solo-btn').click();
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();

  const info = await page.evaluate(() => (window as any).__music());
  expect(info.songs).toHaveLength(6);
  for (const song of info.songs) {
    expect(song.duration, `${song.title} must last 2-4 minutes`).toBeGreaterThanOrEqual(120);
    expect(song.duration, `${song.title} must last 2-4 minutes`).toBeLessThanOrEqual(240);
  }
  expect(new Set(info.songs.map((song: any) => song.id)).size).toBe(6);
  expect(info.playing, 'the music scheduler must be running after a gesture').toBe(true);
  expect(info.musicOn).toBe(true);

  const played = [info.id];
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate(() => (window as any).__skipSong());
    await page.waitForTimeout(40);
    played.push((await page.evaluate(() => (window as any).__music())).id);
  }
  // The first song is already playing before the deck is drawn; the next six
  // skips are one complete shuffled cycle, then the following six are another.
  expect(new Set(played.slice(1, 7)).size, 'the first cycle must play all six songs').toBe(6);
  expect(new Set(played.slice(7, 13)).size, 'the second cycle must play all six songs').toBe(6);
  for (let i = 1; i < played.length; i += 1) expect(played[i]).not.toBe(played[i - 1]);
  const after = await page.evaluate(() => (window as any).__music());
  expect(after.crossfades).toBeGreaterThanOrEqual(12);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('V4/V13: all-angle sky audit and camera drag never leave a floating sky object', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await newContext(browser, { width: 1280, height: 720 });
  const page = await context.newPage();
  const errors = watchConsole(page);
  await page.goto('/?e2e&visual');
  await page.locator('#solo-btn').click();
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();
  await page.evaluate(() => {
    (window as any).__sky.setRunning(false);
    (window as any).__sky.setHour(12);
  });
  await page.waitForTimeout(350);
  await page.waitForFunction(() => {
    const debug = (window as any).__cityDebug;
    return debug && debug.requested > 0 && debug.loaded + debug.failed >= debug.requested;
  }, undefined, { timeout: 45_000 });

  // Every rooftop prop must sit on its building, not in the sky. The broken
  // double-scale path put these 50-170 units up; the tallest skyline is 13.
  const props = await page.evaluate(() => {
    const group = (window as any).__cityGroup as any;
    group.updateMatrixWorld(true);
    let count = 0;
    let maxY = -Infinity;
    group.traverse((object: any) => {
      if (!['barrel', 'crate', 'satellite', 'tree-small'].includes(object.name)) return;
      count += 1;
      maxY = Math.max(maxY, object.matrixWorld.elements[13]);
    });
    return { count, maxY };
  });
  expect(props.count, 'the city must actually place rooftop props').toBeGreaterThan(0);
  expect(props.maxY, 'a rooftop prop is floating above the city').toBeLessThan(20);

  const noon = await page.evaluate(() => (window as any).__sky.audit());
  expect(noon.sun.opacity, 'the sun must be visible at noon').toBeGreaterThan(0.9);
  expect(noon.sun.y, 'the noon sun must be above the horizon').toBeGreaterThan(40);
  expect(noon.moon.opacity).toBe(0);
  expect(noon.clouds).toHaveLength(16);
  for (const cloud of noon.clouds) {
    expect(cloud.y).toBeGreaterThan(15);
    expect(cloud.y).toBeLessThan(45);
    expect(Math.abs(cloud.x)).toBeLessThanOrEqual(130);
    expect(Math.abs(cloud.z)).toBeLessThanOrEqual(130);
  }
  // Lower the camera to the horizon so the sky, sun and clouds are in frame;
  // the normal board framing looks down and hides them.
  await page.evaluate(() => {
    (window as any).__stage.rig.orbit(0, -10_000);
    (window as any).__stage.rig.zoom(10_000);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/round8-proof/v4-sky-noon.png' });

  // Drag hard in both directions, then snap the board to all four sides.
  const canvas = page.locator('#scene');
  const box = (await canvas.boundingBox())!;
  for (const [dx, dy] of [[520, 180], [-620, -140]] as const) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(() => (window as any).__stage.rig.snap(1));
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: 'docs/round8-proof/v4-sky-orbited.png' });

  await page.evaluate(() => {
    (window as any).__sky.setHour(0);
    (window as any).__stage.rig.orbit(0, -10_000);
  });
  await page.waitForTimeout(800);
  const night = await page.evaluate(() => (window as any).__sky.audit());
  expect(night.sun.opacity, 'the sun must be hidden at midnight').toBe(0);
  expect(night.moon.opacity, 'the moon must be visible at midnight').toBeGreaterThan(0.8);
  expect(night.moon.y, 'the moon must stay above the horizon').toBeGreaterThan(10);
  expect(night.stars).toBeGreaterThan(0.5);
  expect(errors, errors.join('\n')).toEqual([]);
  await page.screenshot({ path: 'docs/round8-proof/v4-sky-night.png' });
});

test('V8/V16: robbery UI reaches jail and the jail roll returns dice and consumes a turn', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await newContext(browser);
  const page = await context.newPage();
  const errors = watchConsole(page);
  await page.goto('/?e2e');
  await page.locator('#solo-btn').click();
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();

  const under = page.locator('#dock button').filter({ hasText: 'Underworld' }).first();
  const drainWheels = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) {
      const chance = page.locator('.chance-overlay').first();
      if ((await chance.count()) === 0) {
        await page.waitForTimeout(500);
        if ((await page.locator('.chance-overlay').count()) === 0) return;
      }
      const label = await chance.getAttribute('aria-label');
      const colors = await chance.locator('.chance-legend i').evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).backgroundColor),
      );
      if (label === 'Jail property sale') {
        expect(colors, 'the jail sale must show all three outcomes').toHaveLength(3);
        expect(new Set(colors).size, 'none/some/all must not all be red').toBe(3);
        await page.screenshot({ path: 'docs/round8-proof/v10-jail-sale-wheel.png' });
      }
      await chance.getByRole('button', { name: 'Spin', exact: true }).click();
      await expect(chance.locator('.chance-continue')).toBeVisible({ timeout: 15_000 });
      await chance.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.waitForTimeout(500);
    }
    expect(await page.locator('.chance-overlay').count()).toBe(0);
  };
  let jailed = false;
  for (let attempt = 0; attempt < 8 && !jailed; attempt += 1) {
    await under.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Plan heist', exact: true }).click();
    await page.getByRole('button', { name: 'Review heist' }).click();
    await page.getByRole('button', { name: /attempt the robbery/i }).click();
    await expect(page.locator('#crime-result')).toBeVisible({ timeout: 15_000 });
    jailed = await page.evaluate(() => {
      const state = (window as any).__state();
      const me = Object.values(state.players).find((p: any) => !p.isBot) as any;
      return Boolean(me.inJail);
    });
    await page.locator('#crime-result').getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#crime-result')).toHaveCount(0);
    // The server-odds wheel reveals the result only after the spin (V7), and a
    // failed heist immediately queues the jail property-sale wheel.
    await page.waitForTimeout(300);
    await drainWheels();
    await expect(page.locator('#roll-btn')).toBeEnabled({ timeout: 30_000 });
    await page.waitForTimeout(250);
  }
  expect(jailed, 'a failed heist must send the player to jail').toBe(true);
  await expect(page.locator('#roll-btn')).toHaveText('SERVE');
  await page.screenshot({ path: 'docs/round8-proof/v16-jail-before-roll.png' });

  const before = await page.evaluate(() => {
    const state = (window as any).__state();
    const me = Object.values(state.players).find((p: any) => !p.isBot) as any;
    return { turns: me.jailTurns, inJail: me.inJail };
  });
  await page.locator('#roll-btn').click();
  // A jail roll must settle: either doubles release the player or one turn of
  // the sentence is consumed. A missing dice result leaves this unchanged.
  await page.waitForFunction((previous) => {
    const state = (window as any).__state();
    const me = Object.values(state.players).find((p: any) => !p.isBot) as any;
    return me.inJail !== previous.inJail || me.jailTurns !== previous.turns;
  }, before, { timeout: 20_000 });
  const after = await page.evaluate(() => {
    const state = (window as any).__state();
    const me = Object.values(state.players).find((p: any) => !p.isBot) as any;
    return { turns: me.jailTurns, inJail: me.inJail };
  });
  expect(after.inJail !== before.inJail || after.turns !== before.turns).toBe(true);
  await page.screenshot({ path: 'docs/round8-proof/v16-jail-after-roll.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('V19: UI scale previews and applies at 80, 100 and 130 percent', async ({ browser }) => {
  const context = await newContext(browser, { width: 1440, height: 900 });
  const page = await context.newPage();
  const errors = watchConsole(page);
  await page.goto('/?e2e');
  await page.locator('.menu').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const slider = page.locator('.ui-scale-controls input[type="range"]');
  const apply = page.locator('.ui-scale-controls').getByRole('button', { name: 'Apply' });
  for (const scale of [80, 100, 130]) {
    await slider.evaluate((el, value) => {
      (el as HTMLInputElement).value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, scale);
    await apply.click();
    const applied = await page.evaluate(() => ({
      root: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim(),
      font: parseFloat(getComputedStyle(document.getElementById('ui')!).fontSize),
    }));
    expect(Number(applied.root), `applied ${scale}%`).toBeCloseTo(scale / 100, 3);
    expect(applied.font).toBeCloseTo(15 * (scale / 100), 1);
    await page.screenshot({ path: `docs/round8-proof/v19-ui-scale-${scale}.png` });
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
