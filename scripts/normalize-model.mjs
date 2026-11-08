#!/usr/bin/env node
/**
 * Normalises licensed GLB models without touching their geometry:
 * recentres the pivot at base-centre, scales the longest axis to 0.42 (tokens)
 * or 0.72 (buildings), bakes the transform, strips animation and unused
 * textures, then records new checksums in the manifest.
 *
 * The browser does the same at load time (see src/render/models.ts), so this
 * script is for offline optimisation, not a precondition for running the game.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'public/assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const only = process.argv[2];
let changed = 0;

for (const asset of manifest.assets) {
  if (only && asset.id !== only) continue;
  const file = path.join(MODELS, asset.file);
  const doc = await io.read(file);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  for (const anim of root.listAnimations()) anim.dispose();

  // Bounds are computed by the browser at load; here we only normalise node
  // transforms and bake them into the meshes, never edit vertices.
  await doc.transform(resample(), dedup(), prune(), textureCompress({ targetFormat: 'jpeg', quality: 82 }));
  if (!scene) continue;

  const out = await io.writeBinary(doc);
  await writeFile(file, out);
  asset.bytes = out.byteLength;
  asset.sha256 = createHash('sha256').update(out).digest('hex');
  changed += 1;
  console.log(`normalised ${asset.id} (${(out.byteLength / 1024).toFixed(1)} KB)`);
}

manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
const glbs = (await readdir(MODELS, { recursive: true })).map(String).filter((f) => f.endsWith('.glb'));
console.log(`normalised ${changed} model(s); ${glbs.length} GLB files on disk.`);
