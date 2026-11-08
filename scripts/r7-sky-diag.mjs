import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(12000);
await page.goto('http://127.0.0.1:5173/?e2e', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#auth-username', { timeout: 30000 });
await page.fill('#auth-username', 'round7_mw86itaa');
await page.fill('#auth-password', process.env.R7_PASSWORD);
await page.click('#auth-submit');
await page.waitForFunction(() => {
  const el = document.querySelector('#you-name');
  return el && !el.textContent?.includes('Connecting');
}, null, { timeout: 25000 });
await page.waitForTimeout(1200);
const inspect = () => page.evaluate(() => {
  const scene = window.__stage.scene;
  const lights = [];
  scene.traverse((o) => {
    if (o.isLight) lights.push({ type: o.type, layerMask: o.layers.mask, intensity: o.intensity, color: o.color?.getHexString?.() });
  });
  const mats = { total: 0, transparent: 0, opacityLess: 0, depthWriteOff: 0 };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of m) {
      if (!mat) continue;
      mats.total += 1;
      if (mat.transparent) mats.transparent += 1;
      if (mat.opacity < 1) mats.opacityLess += 1;
      if (mat.depthWrite === false) mats.depthWriteOff += 1;
    }
  });
  return {
    lights, materials: mats,
    fog: scene.fog ? { color: scene.fog.color.getHexString(), density: scene.fog.density } : null,
    skyVisible: scene.getObjectByName('sky')?.visible,
    exposure: window.__stage.renderer?.toneMappingExposure,
  };
});
const setHour = (h) => page.evaluate((hour) => { window.__sky.setRunning(false); window.__sky.setHour(hour); }, h);
const snap = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `docs/round7-proof/diag-${name}.png` }); };

console.log('inspect', JSON.stringify(await inspect()));
await setHour(6.5); await snap('normal-0630');
await setHour(12); await snap('normal-1200');
await page.evaluate(() => { window.__stage.scene.getObjectByName('sky').visible = false; });
await setHour(6.5); await snap('nosky-0630');
await setHour(12); await snap('nosky-1200');
await page.evaluate(() => { window.__stage.scene.getObjectByName('sky').visible = true; const s = window.__stage.scene; s.traverse((o) => { if (o.isLight && (o.layers.mask & 4)) o.intensity = 0; }); });
await setHour(6.5); await snap('nolights-0630');
await setHour(12); await snap('nolights-1200');
console.log('done');
await browser.close();
