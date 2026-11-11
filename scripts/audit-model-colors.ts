#!/usr/bin/env node
/**
 * Build gate for model appearance.
 *
 * Every shipped GLB is opened and every material/primitive pair is checked for:
 * - a real material (no primitive with no material);
 * - no pure-white / flat-grey material without a colour texture or vertex colour;
 * - no fully transparent material;
 * - no 1x1 "canvas" texture masquerading as a colour map;
 * - no material with a colour texture used by a primitive with no UVs.
 *
 * The output is a machine-readable report plus a short human table. Any failure
 * exits 1, so `npm run build` and `npm test` refuse to ship a grey/untextured
 * model.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type MaterialReport = {
  name: string;
  baseColor: [number, number, number, number];
  texture: boolean;
  textureSize: [number, number] | null;
  vertexColors: boolean;
  alpha: number;
  failures: string[];
};

type ModelReport = {
  id: string;
  file: string;
  kind: string;
  bytes: number;
  sha256: string;
  meshes: number;
  primitives: number;
  texturedPrimitives: number;
  vertexColourPrimitives: number;
  materials: MaterialReport[];
  failures: string[];
  passed: boolean;
};

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'public/assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');
const OUT_JSON = path.join(ROOT, 'docs/round10-model-audit.json');
const OUT_MD = path.join(ROOT, 'docs/round10-model-audit.md');

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

function isFlatNeutral([r, g, b]: [number, number, number, number]): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // A dark charcoal/black is a deliberate detail colour, not a grey placeholder.
  return max - min < 0.008 && max > 0.55;
}

function imageSize(bytes: Uint8Array, mime: string): [number, number] | null {
  try {
    if (mime.includes('png') && bytes.length >= 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return [view.getUint32(16), view.getUint32(20)];
    }
    if (mime.includes('jpeg') || mime.includes('jpg')) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1]!;
        const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
        if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
          return [(bytes[offset + 7]! << 8) | bytes[offset + 8]!, (bytes[offset + 5]! << 8) | bytes[offset + 6]!];
        }
        offset += 2 + length;
      }
    }
    if (mime.includes('webp') && bytes.length >= 30) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const chunk = String.fromCharCode(...bytes.slice(12, 16));
      if (chunk === 'VP8X') return [1 + (view.getUint32(24, true) & 0xffffff), 1 + (view.getUint32(27, true) & 0xffffff)];
      if (chunk === 'VP8 ') return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    }
  } catch {
    return null;
  }
  return null;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as {
  assets: Array<{ id: string; file: string; kind: string; bytes: number; sha256: string }>;
};
const reports: ModelReport[] = [];

for (const asset of manifest.assets) {
  const file = path.join(MODELS, asset.file);
  const bytes = await readFile(file);
  const report: ModelReport = {
    id: asset.id,
    file: asset.file,
    kind: asset.kind,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    meshes: 0,
    primitives: 0,
    texturedPrimitives: 0,
    vertexColourPrimitives: 0,
    materials: [],
    failures: [],
    passed: true,
  };
  if (report.sha256 !== asset.sha256) report.failures.push('manifest checksum does not match the file');
  try {
    const doc = await io.read(file);
    const root = doc.getRoot();
    report.meshes = root.listMeshes().length;
    const materialReports = new Map<string, MaterialReport>();
    const textureSizes = new Map<string, [number, number] | null>();
    for (const texture of root.listTextures()) {
      const mime = texture.getMimeType();
      textureSizes.set(texture.getName(), imageSize(texture.getImage()!, mime));
    }

    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        report.primitives += 1;
        const material = prim.getMaterial();
        const hasUv = Boolean(prim.getAttribute('TEXCOORD_0'));
        const hasVertexColour = Boolean(prim.getAttribute('COLOR_0'));
        if (!material) {
          report.failures.push(`${mesh.getName() || 'unnamed mesh'} has a primitive with no material`);
          continue;
        }
        const key = material.getName() || `unnamed-${materialReports.size}`;
        let entry = materialReports.get(key);
        if (!entry) {
          const colour = material.getBaseColorFactor();
          const baseColor: [number, number, number, number] = [colour[0]!, colour[1]!, colour[2]!, colour[3]!];
          const texture = material.getBaseColorTexture();
          const textureSize = texture ? (textureSizes.get(texture.getName()) ?? null) : null;
          entry = {
            name: material.getName() || 'unnamed material',
            baseColor,
            texture: Boolean(texture),
            textureSize,
            vertexColors: hasVertexColour,
            alpha: baseColor[3],
            failures: [],
          };
          materialReports.set(key, entry);
        }
        entry.vertexColors ||= hasVertexColour;
        if (entry.texture) {
          report.texturedPrimitives += 1;
          if (!hasUv) entry.failures.push('has a base-colour texture but the primitive has no UVs');
          if (entry.textureSize && (entry.textureSize[0] <= 1 || entry.textureSize[1] <= 1)) {
            entry.failures.push(`uses a ${entry.textureSize[0]}x${entry.textureSize[1]} canvas as its colour map`);
          }
        } else if (!hasVertexColour && isFlatNeutral(entry.baseColor)) {
          entry.failures.push('pure white / flat grey material with no texture and no vertex colours');
        }
        if (entry.alpha <= 0.01) entry.failures.push('fully transparent material');
        if (hasVertexColour) report.vertexColourPrimitives += 1;
      }
    }
    report.materials = [...materialReports.values()];
    if (report.primitives === 0) report.failures.push('model has no mesh primitives');
    if (report.materials.length === 0) report.failures.push('model has no materials');
    for (const material of report.materials) {
      for (const failure of material.failures) report.failures.push(`${material.name}: ${failure}`);
    }
  } catch (error) {
    report.failures.push(`could not open GLB: ${error instanceof Error ? error.message : String(error)}`);
  }
  report.passed = report.failures.length === 0;
  reports.push(report);
}

const failed = reports.filter((report) => !report.passed);
const summary = {
  generatedAt: new Date().toISOString(),
  checked: reports.length,
  passed: reports.length - failed.length,
  failed: failed.length,
  flatMaterialFailures: failed.reduce((sum, report) => sum + report.failures.length, 0),
  models: reports,
};
await mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`);
const rows = reports
  .map((report) => `| ${report.kind} | ${report.id} | ${report.materials.length} | ${report.texturedPrimitives} | ${report.vertexColourPrimitives} | ${report.passed ? 'PASS' : 'FAIL'} |`)
  .join('\n');
await writeFile(
  OUT_MD,
  `# Model colour audit\n\nGenerated ${summary.generatedAt} by \`scripts/audit-model-colors.ts\`.\n\n- Checked: **${summary.checked}** GLBs\n- Passed: **${summary.passed}**\n- Failed: **${summary.failed}**\n\nA model fails if a primitive has no material, a material is pure white/flat grey without a texture or vertex colour, a material is fully transparent, a texture is a 1x1 canvas, or a textured primitive has no UVs. Dark charcoal/black outlines are not treated as grey placeholders.\n\n| Kind | Model | Materials | Textured prims | Vertex-colour prims | Result |\n|---|---|---:|---:|---:|---|\n${rows}\n\n${failed.length ? `## Failures\n\n${failed.map((report) => `### ${report.id}\n\n${report.failures.map((f) => `- ${f}`).join('\n')}`).join('\n\n')}\n` : '## Failures\n\nNone. Every shipped model has a deliberate colour source.\n'}`,
);

console.log(`MODEL COLOUR AUDIT ${failed.length ? 'FAILED' : 'PASSED'} — ${reports.length} GLBs, ${reports.reduce((sum, r) => sum + r.primitives, 0)} primitives, ${reports.reduce((sum, r) => sum + r.materials.length, 0)} material uses.`);
for (const report of failed) {
  console.error(`  ✗ ${report.id}: ${report.failures.join('; ')}`);
}
if (failed.length) process.exit(1);
