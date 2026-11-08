#!/usr/bin/env node
/**
 * Fails a Pages build before upload when index.html points at a missing bundle,
 * a CSS/manifest asset is absent, or the licensed model set is incomplete.
 *
 * PAGES_DIST can point the check at a fixture for a negative test.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve(process.env.PAGES_DIST ?? 'dist');
const errors = [];
const checked = new Set();

function fail(message) {
  errors.push(message);
}

async function checkFile(relative, source) {
  const full = path.resolve(DIST, relative);
  if (full !== DIST && !full.startsWith(`${DIST}${path.sep}`)) {
    fail(`${source}: path escapes dist (${relative})`);
    return null;
  }
  try {
    const info = await stat(full);
    if (!info.isFile()) {
      fail(`${source}: not a file (${relative})`);
      return null;
    }
    if (info.size === 0) {
      fail(`${source}: empty file (${relative})`);
      return null;
    }
    checked.add(full);
    return info;
  } catch {
    fail(`${source}: missing file (${relative})`);
    return null;
  }
}

function localRef(raw) {
  const ref = raw.trim();
  if (!ref || ref.startsWith('#') || ref.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(ref)) return null;
  try {
    return decodeURIComponent(ref.split(/[?#]/, 1)[0]);
  } catch {
    fail(`invalid URL encoding: ${raw}`);
    return null;
  }
}

let html;
try {
  html = await readFile(path.join(DIST, 'index.html'), 'utf8');
} catch {
  console.error(`PAGES SMOKE TEST FAILED — no readable index.html in ${DIST}`);
  process.exit(1);
}

if (!html.trim()) fail('index.html is empty');
if (html.includes('/src/main.ts') || html.includes('id="static-source-redirect"')) {
  fail('index.html still contains the Vite development entry or source redirect');
}

const htmlRefs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
const cssRefs = [];
let jsCount = 0;
let cssCount = 0;

for (const ref of htmlRefs) {
  const relative = localRef(ref);
  if (!relative) continue;
  if (relative.startsWith('/')) {
    fail(`index.html: root-absolute URL breaks project Pages (${ref})`);
    continue;
  }
  const extension = path.extname(relative).toLowerCase();
  if (extension === '.js') jsCount += 1;
  if (extension === '.css') cssRefs.push(relative);
  if (extension === '.css') cssCount += 1;
  await checkFile(relative, `index.html -> ${ref}`);
}

if (jsCount === 0) fail('index.html does not reference a JavaScript bundle');
if (cssCount === 0) fail('index.html does not reference a stylesheet');

for (const relative of cssRefs) {
  const cssPath = path.join(DIST, relative);
  let css;
  try {
    css = await readFile(cssPath, 'utf8');
  } catch {
    continue;
  }
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
    const assetRef = localRef(match[2]);
    if (!assetRef) continue;
    if (assetRef.startsWith('/')) {
      fail(`${relative}: root-absolute asset breaks project Pages (${match[2]})`);
      continue;
    }
    const assetPath = path.resolve(path.dirname(cssPath), assetRef);
    await checkFile(assetPath, `${relative} -> ${match[2]}`);
  }
}

for (const font of ['Inter-var.ttf', 'Outfit-var.ttf', 'LilitaOne-Regular.ttf']) {
  await checkFile(path.join('fonts', font), 'required font');
}

const manifestPath = path.join(DIST, 'assets', 'models', 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {
  fail('assets/models/manifest.json is missing or invalid');
}

let modelCount = 0;
let tokenCount = 0;
let buildingCount = 0;
if (manifest && Array.isArray(manifest.assets)) {
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.file !== 'string') {
      fail('model manifest entry has no file');
      continue;
    }
    modelCount += 1;
    if (asset.kind === 'token') tokenCount += 1;
    if (asset.kind === 'building') buildingCount += 1;
    await checkFile(path.join('assets', 'models', asset.file), `model ${asset.id ?? asset.file}`);
  }
  if (modelCount === 0) fail('model manifest is empty');
  if (tokenCount < 50) fail(`model manifest has only ${tokenCount} tokens (need 50+)`);
  if (buildingCount < 7) fail(`model manifest has only ${buildingCount} building types (need 7+)`);
} else {
  fail('model manifest has no assets array');
}

if (errors.length) {
  console.error(`PAGES SMOKE TEST FAILED — ${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

const distFiles = (await readdir(DIST, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile()).length;
console.log(
  `PAGES SMOKE TEST PASSED — ${distFiles} dist files, ${checked.size} required files present, ` +
    `${jsCount} JS bundle, ${cssCount} CSS bundle, ${modelCount} licensed models ` +
    `(${tokenCount} tokens, ${buildingCount} buildings).`,
);
