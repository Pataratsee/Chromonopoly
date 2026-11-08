import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('measures cold load, transfer size and 1080p frame pacing', async ({ page, request }) => {
  test.setTimeout(120_000);
  const reset = await request.post('/api/test/reset');
  expect(reset.ok()).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const started = Date.now();
  await page.goto('/?e2e');
  await expect(page.locator('#multi-btn')).toBeVisible();
  const wallColdMs = Date.now() - started;

  const cold = await page.evaluate(() => {
    const ready = performance.getEntriesByName('chromonopoly-ready')[0];
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      readyMs: Math.round(ready?.startTime ?? -1),
      domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd ?? -1),
      loadMs: Math.round(nav?.loadEventEnd ?? -1),
      transferKB: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0) / 1024),
      resourceCount: resources.length,
    };
  });

  await page.locator('#name-input').fill('Perf QA');
  await page.locator('#multi-btn').click();
  await expect(page.locator('#roll-btn')).toBeVisible();
  await page.waitForTimeout(2000);

  const frames = await page.evaluate(async () => {
    const deltas: number[] = [];
    let previous = performance.now();
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        resolve();
      };
      const deadline = previous + 3000;
      const guard = window.setTimeout(finish, 5000);
      const frame = (now: number): void => {
        deltas.push(now - previous);
        previous = now;
        if (now < deadline && !done) requestAnimationFrame(frame);
        else {
          window.clearTimeout(guard);
          finish();
        }
      };
      requestAnimationFrame(frame);
    });
    return deltas.slice(3);
  });
  const sorted = [...frames].sort((a, b) => a - b);
  const average = frames.reduce((a, b) => a + b, 0) / frames.length;
  const result = {
    cold,
    wallColdMs,
    frame: {
      samples: frames.length,
      averageMs: Number(average.toFixed(2)),
      fps: Number((1000 / average).toFixed(1)),
      p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)]!.toFixed(2)),
      longFrames: frames.filter((ms) => ms > 20).length,
      over33ms: frames.filter((ms) => ms > 33).length,
    },
    measuredAt: new Date().toISOString(),
  };
  writeFileSync('screenshots/perf.json', `${JSON.stringify(result, null, 2)}\n`);
  test.info().annotations.push({ type: 'performance', description: JSON.stringify(result) });
  console.log('PERFORMANCE', JSON.stringify(result));
  expect(cold.readyMs).toBeGreaterThan(0);
});
