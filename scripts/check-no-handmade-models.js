#!/usr/bin/env node
/**
 * Enforces the brief's hardest rule: no hand-made 3D objects.
 *
 * 1. Primitive geometry is allowed only in src/board/ and src/ui/ (flat board,
 *    tiles, owner rings, ground, background, UI). Those files may use only the
 *    flat/plane primitives below.
 * 2. No other source file may instantiate a primitive geometry at all.
 * 3. Every token and building in the game must come from the manifest, and every
 *    manifest entry must point at a real file with a licence and a source.
 * 4. Every .glb on disk must be recorded in the manifest.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const MODELS = path.join(ROOT, 'public/assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');

const ALLOWED_DIRS = ['src/board/', 'src/ui/'];
const FLAT = ['PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'ShapeGeometry', 'BoxGeometry', 'BufferGeometry'];
const FORBIDDEN = [
  'CylinderGeometry',
  'SphereGeometry',
  'ConeGeometry',
  'TorusGeometry',
  'CapsuleGeometry',
  'LatheGeometry',
  'ExtrudeGeometry',
  'TubeGeometry',
  'IcosahedronGeometry',
  'OctahedronGeometry',
  'DodecahedronGeometry',
  'TetrahedronGeometry',
  'PolyhedronGeometry',
];

const errors = [];
let checked = 0;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = await walk(SRC);
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const code = await readFile(file, 'utf8');
  checked += 1;
  const used = FORBIDDEN.filter((g) => new RegExp(`new\\s+(THREE\\.)?${g}\\s*\\(`).test(code));
  const allowedHere = ALLOWED_DIRS.some((d) => rel.startsWith(d));
  if (!allowedHere && used.length) {
    errors.push(`${rel}: forbidden primitive geometry (${used.join(', ')}) — every object must be a downloaded model`);
  }
  if (allowedHere) {
    const stray = used.filter((g) => !FLAT.includes(g));
    if (stray.length) errors.push(`${rel}: flat-shape zone may not build objects (${stray.join(', ')})`);
    if (/function\s+(make|create|build)(House|Car|Hat|Tree|Token|Building|Dice|Card)/i.test(code)) {
      errors.push(`${rel}: looks like a hand-built object helper — objects must be loaded models`);
    }
  }
  if (/from\s+['"][^'"]*BoxGeometry['"]/.test(code)) errors.push(`${rel}: direct geometry import outside a loader`);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
} catch {
  errors.push('assets/models/manifest.json is missing');
}

if (manifest) {
  const ids = new Set();
  for (const a of manifest.assets) {
    if (ids.has(a.id)) errors.push(`manifest: duplicate id ${a.id}`);
    ids.add(a.id);
    if (!a.sourceUrl || !a.author || !a.license) errors.push(`manifest: ${a.id} missing source/author/licence`);
    if (!a.sha256) errors.push(`manifest: ${a.id} has no checksum`);
    try {
      const st = await stat(path.join(MODELS, a.file));
      if (st.size === 0) errors.push(`manifest: ${a.id} file is empty`);
      if (st.size !== a.bytes) errors.push(`manifest: ${a.id} size ${st.size} != recorded ${a.bytes}`);
    } catch {
      errors.push(`manifest: ${a.id} file missing on disk (${a.file})`);
    }
  }
  const tokens = manifest.assets.filter((a) => a.kind === 'token');
  const buildings = manifest.assets.filter((a) => a.kind === 'building');
  if (tokens.length < 50) errors.push(`tokens: only ${tokens.length} in the manifest, the brief requires 50+`);
  if (buildings.length < 7) errors.push(`buildings: only ${buildings.length} in the manifest, the brief requires 7 types`);

  // every token/building id used by the game must exist in the manifest
  const source = await readFile(path.join(SRC, 'render/models.ts'), 'utf8').catch(() => '');
  for (const id of [...source.matchAll(/assetId:\s*'([^']+)'/g)].map((m) => m[1])) {
    if (!ids.has(id)) errors.push(`src/render/models.ts references unknown asset id "${id}"`);
  }

  const disk = (await readdir(MODELS, { recursive: true })).map(String).filter((f) => f.endsWith('.glb'));
  for (const f of disk) {
    if (!manifest.assets.some((a) => a.file.split(path.sep).join('/') === f.split(path.sep).join('/'))) {
      errors.push(`unlicensed model on disk: ${f} (not in manifest)`);
    }
  }
}

if (errors.length) {
  console.error('NO-HANDMADE-MODELS CHECK FAILED');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
const tokens = manifest.assets.filter((a) => a.kind === 'token').length;
const buildings = manifest.assets.filter((a) => a.kind === 'building').length;
console.log(`NO-HANDMADE-MODELS CHECK PASSED — ${checked} source files scanned, ${tokens} licensed token models, ${buildings} licensed building models, 0 primitive objects outside src/board and src/ui.`);
