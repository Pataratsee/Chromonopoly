#!/usr/bin/env node
/**
 * Losslessly compresses the licensed Kenney GLB geometry with EXT_meshopt_compression.
 * The runtime already registers MeshoptDecoder. Textures, material values and
 * vertex data are preserved; only the byte encoding changes. Manifest sizes and
 * SHA-256 hashes are refreshed in place.
 */
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'public/assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

await MeshoptEncoder.ready;

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
let beforeTotal = 0;
let afterTotal = 0;
let changed = 0;

for (const asset of manifest.assets) {
  const file = path.join(MODELS, asset.file);
  const before = (await stat(file)).size;
  beforeTotal += before;
  const doc = await io.read(file);
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = Buffer.from(await io.writeBinary(doc));
  if (out.byteLength < before) {
    await writeFile(file, out);
    asset.bytes = out.byteLength;
    asset.sha256 = createHash('sha256').update(out).digest('hex');
    changed += 1;
  }
  afterTotal += Math.min(before, out.byteLength);
  console.log(`${asset.id.padEnd(14)} ${(before / 1024).toFixed(1).padStart(7)} KB -> ${(Math.min(before, out.byteLength) / 1024).toFixed(1).padStart(7)} KB`);
}

manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`compressed ${changed} model(s): ${(beforeTotal / 1048576).toFixed(2)} MB -> ${(afterTotal / 1048576).toFixed(2)} MB`);
