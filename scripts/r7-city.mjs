import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(180000);
const logs = [];
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173/?e2e&visual', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'round7_mw86itaa');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting') && window.__cityDebug?.ok && window.__cityDebug.loaded > 0;
}, null, { timeout: 150000 });
await page.waitForTimeout(3000);
const debug = await page.evaluate(() => ({ debug: window.__cityDebug, stats: window.__cityStats() }));
const audit = await page.evaluate(() => {
  const g = window.__cityGroup;
  let groups = 0, nonUniformGroups = 0, meshes = 0, nonUniformMeshes = 0;
  const examples = [];
  g.traverse((o) => {
    const s = o.scale;
    const nonUniform = Math.abs(s.x - s.y) > 1e-6 || Math.abs(s.y - s.z) > 1e-6 || Math.abs(s.x - s.z) > 1e-6;
    if (o.isGroup) { groups += 1; if (nonUniform) { nonUniformGroups += 1; if (examples.length < 8) examples.push({ name: o.name, s: [s.x, s.y, s.z] }); } }
    if (o.isMesh) { meshes += 1; if (nonUniform) nonUniformMeshes += 1; }
  });
  return { groups, nonUniformGroups, meshes, nonUniformMeshes, examples };
});
logs.push('city debug: ' + JSON.stringify(debug));
logs.push('scale audit: ' + JSON.stringify(audit));
// Zoom out to see the full ring, then capture eight 45-degree views.
await page.evaluate(() => {
  const rig = window.__stage.rig;
  rig.wantRadius = 40;
  rig.wantPitch = 0.72;
  rig.reset();
  rig.wantRadius = 40;
  rig.wantPitch = 0.72;
});
await page.waitForTimeout(1400);
for (let i = 0; i < 8; i += 1) {
  await page.evaluate((angle) => {
    const rig = window.__stage.rig;
    rig.snapFrom = null;
    rig.wantYaw = angle;
    rig.wantPitch = 0.72;
    rig.wantRadius = 40;
    rig.manualUntil = performance.now() + 100000;
  }, Math.PI / 4 + i * Math.PI / 4);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `docs/round7-proof/r7-city-${i * 45}deg.png` });
  logs.push(`captured ${i * 45}deg yaw=${await page.evaluate(() => window.__stage.rig.yaw.toFixed(3))}`);
}
logs.push('console errors: ' + JSON.stringify(errors.filter((e) => /error|failed|texture|GLTF/i.test(e)).slice(0, 20)));
writeFileSync('docs/round7-proof/city.log', logs.join('\n') + '\n');
console.log(logs.join('\n'));
await browser.close();
