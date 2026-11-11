#!/usr/bin/env node
/**
 * Reproducible material fix for the one licensed model the colour audit found
 * without a colour source. The satellite's `_defaultMat` is pure white in the
 * upstream Kenney GLB. We keep every vertex untouched and only recolour that
 * one material to the slate-steel used by the rest of the dish.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'public/assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const asset = JSON.parse(await readFile(MANIFEST, 'utf8')).assets.find((entry) => entry.id === 'satellite');
if (!asset) throw new Error('satellite asset missing from manifest');
const file = path.join(MODELS, asset.file);
const doc = await io.read(file);
const material = doc.getRoot().listMaterials().find((entry) => entry.getName() === '_defaultMat');
if (!material) throw new Error('satellite _defaultMat not found');
material.setBaseColorFactor([0.42, 0.51, 0.56, 1]);
material.setMetallicFactor(0.55);
material.setRoughnessFactor(0.38);
const out = Buffer.from(await io.writeBinary(doc));
await writeFile(file, out);
asset.bytes = out.byteLength;
asset.sha256 = createHash('sha256').update(out).digest('hex');
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const target = manifest.assets.find((entry) => entry.id === 'satellite');
target.bytes = asset.bytes;
target.sha256 = asset.sha256;
manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`recoloured satellite _defaultMat; ${asset.bytes} bytes, ${asset.sha256.slice(0, 12)}…`);
