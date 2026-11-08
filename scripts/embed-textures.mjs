#!/usr/bin/env node
/**
 * Kenney's GLBs reference `Textures/colormap.png` as a sibling file. Our models
 * are flattened into tokens/ and buildings/, so that relative path would 404.
 * This script downloads each kit's colormap once, stages the model beside it,
 * embeds the texture into the GLB, and updates the manifest checksum/size.
 *
 * Only resources and packaging change; geometry is untouched.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'public/assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');
const STAGE = path.join(ROOT, '.tmp-models');
const MIRROR = 'https://raw.githubusercontent.com/shorepine/kenney/main/3d';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const textures = new Map();
let embedded = 0;

async function fetchTexture(kit, uri) {
  const key = `${kit}/${uri}`;
  if (textures.has(key)) return textures.get(key);
  const url = `${MIRROR}/${kit}/${uri.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  textures.set(key, buf);
  console.log(`  texture ${kit}/${uri} (${(buf.length / 1024).toFixed(1)} KB)`);
  return buf;
}

for (const asset of manifest.assets) {
  const file = path.join(MODELS, asset.file);
  const glb = await readFile(file);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const uris = [...(json.images ?? []), ...(json.buffers ?? [])].map((r) => r.uri).filter(Boolean);
  const external = uris.filter((u) => !u.startsWith('data:'));
  if (!external.length) continue;

  const stageDir = path.join(STAGE, `${asset.kind}-${asset.id}`);
  await mkdir(stageDir, { recursive: true });
  await writeFile(path.join(stageDir, 'model.glb'), glb);
  for (const uri of external) {
    const buf = await fetchTexture(asset.kit, uri);
    const dest = path.join(stageDir, uri);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
  }

  const doc = await io.read(path.join(stageDir, 'model.glb'));
  const out = Buffer.from(await io.writeBinary(doc));
  await writeFile(file, out);
  asset.bytes = out.byteLength;
  asset.sha256 = createHash('sha256').update(out).digest('hex');
  embedded += 1;
  console.log(`embedded ${asset.id} (${(out.byteLength / 1024).toFixed(1)} KB)`);
}

await rm(STAGE, { recursive: true, force: true });
manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`embedded textures into ${embedded} model(s); ${textures.size} colormap file(s) downloaded.`);
